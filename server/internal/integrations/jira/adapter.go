package jira

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

// Adapter defines the full Jira integration contract.
type Adapter interface {
	GetOAuthURL(ctx context.Context, projectID primitive.ObjectID, state string) (string, error)
	ExchangeOAuthCode(ctx context.Context, projectID primitive.ObjectID, userID, code, jiraProjectKey string) error
	RefreshToken(ctx context.Context, projectID primitive.ObjectID) error
	ImportEpics(ctx context.Context, projectID primitive.ObjectID, jiraProjectKey, userEmail string) ([]ImportResult, error)
	ImportStories(ctx context.Context, projectID primitive.ObjectID, epicKey, userEmail string) ([]ImportResult, error)
	ImportProject(ctx context.Context, projectID primitive.ObjectID, jiraProjectKey, userEmail string) (ProjectImportResult, error)
	ExportFeature(ctx context.Context, projectID, featureID primitive.ObjectID, userEmail string) (ExportResult, error)
	ExportTask(ctx context.Context, projectID, taskID primitive.ObjectID, userEmail string) (ExportResult, error)
	ExportEstimates(ctx context.Context, projectID primitive.ObjectID, featureIDs []string, notes, userEmail string) ([]ExportResult, error)
	GetSyncState(ctx context.Context, projectID primitive.ObjectID) (SyncState, error)
	ResolveSyncConflict(ctx context.Context, projectID primitive.ObjectID, mappingID primitive.ObjectID, winner, userEmail string) error
	ValidateConnection(ctx context.Context, projectID primitive.ObjectID) (bool, error)
}

// ---------------------------------------------------------------------------
// Service struct
// ---------------------------------------------------------------------------

// Service implements Adapter and holds all runtime dependencies.
type Service struct {
	db           *mongo.Database
	oauthCfg     OAuthConfig
	encKey       []byte // must be exactly 32 bytes for AES-256
	integrations *mongo.Collection
	mappings     *mongo.Collection
	history      *mongo.Collection
	projects     *mongo.Collection
}

// NewService constructs a Service.
// encKey must be exactly 32 bytes.
func NewService(db *mongo.Database, cfg OAuthConfig, encKey []byte) *Service {
	return &Service{
		db:           db,
		oauthCfg:     cfg,
		encKey:       encKey,
		integrations: db.Collection("jira_integrations"),
		mappings:     db.Collection("jira_mappings"),
		history:      db.Collection("jira_sync_history"),
		projects:     db.Collection("projects"),
	}
}

// ---------------------------------------------------------------------------
// OAuth methods
// ---------------------------------------------------------------------------

// GetOAuthURL returns the Atlassian authorization URL.
// The caller is responsible for persisting state in the HTTP session for CSRF validation.
func (svc *Service) GetOAuthURL(_ context.Context, _ primitive.ObjectID, state string) (string, error) {
	return GetAuthURL(svc.oauthCfg, state), nil
}

// ExchangeOAuthCode exchanges an authorization code for tokens and stores a JiraIntegration document.
// jiraProjectKey is the Jira project key the user intends to sync (e.g. "DANCE").
func (svc *Service) ExchangeOAuthCode(ctx context.Context, projectID primitive.ObjectID, userID, code, jiraProjectKey string) error {
	accessToken, refreshToken, expiresIn, err := ExchangeCode(ctx, svc.oauthCfg, code)
	if err != nil {
		return fmt.Errorf("exchange code: %w", err)
	}

	resources, err := GetAccessibleResources(ctx, accessToken)
	if err != nil {
		return fmt.Errorf("fetch accessible resources: %w", err)
	}
	if len(resources) == 0 {
		return fmt.Errorf("no Jira Cloud instances found for this account")
	}
	// Use the first resource (most accounts have one).
	cloudID := resources[0].ID
	instanceURL := resources[0].URL

	encAccess, err := EncryptToken(accessToken, svc.encKey)
	if err != nil {
		return fmt.Errorf("encrypt access token: %w", err)
	}
	encRefresh, err := EncryptToken(refreshToken, svc.encKey)
	if err != nil {
		return fmt.Errorf("encrypt refresh token: %w", err)
	}

	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(expiresIn) * time.Second)

	filter := bson.M{"project_id": projectID}
	update := bson.M{
		"$set": bson.M{
			"project_id":       projectID,
			"user_id":          userID,
			"jira_instance_url": instanceURL,
			"jira_cloud_id":    cloudID,
			"jira_project_key": jiraProjectKey,
			"access_token":     encAccess,
			"refresh_token":    encRefresh,
			"token_expires_at": expiresAt,
			"scope":            []string{"read:jira-work", "write:jira-work", "offline_access"},
			"is_active":        true,
			"updated_at":       now,
			"last_used_at":     now,
		},
		"$setOnInsert": bson.M{
			"_id":        primitive.NewObjectID(),
			"created_at": now,
		},
	}
	upsert := true
	_, err = svc.integrations.UpdateOne(ctx, filter, update, &options.UpdateOptions{Upsert: &upsert})
	if err != nil {
		return fmt.Errorf("upsert integration: %w", err)
	}
	return nil
}

// RefreshToken refreshes the stored access token for a project's Jira integration.
func (svc *Service) RefreshToken(ctx context.Context, projectID primitive.ObjectID) error {
	var intg JiraIntegration
	if err := svc.integrations.FindOne(ctx, bson.M{"project_id": projectID, "is_active": true}).Decode(&intg); err != nil {
		return fmt.Errorf("find integration: %w", err)
	}

	decRefresh, err := DecryptToken(intg.RefreshToken, svc.encKey)
	if err != nil {
		return fmt.Errorf("decrypt refresh token: %w", err)
	}

	newAccess, expiresIn, err := RefreshAccessToken(ctx, svc.oauthCfg, decRefresh)
	if err != nil {
		return fmt.Errorf("refresh access token: %w", err)
	}

	encAccess, err := EncryptToken(newAccess, svc.encKey)
	if err != nil {
		return fmt.Errorf("encrypt new access token: %w", err)
	}

	now := time.Now().UTC()
	_, err = svc.integrations.UpdateOne(
		ctx,
		bson.M{"_id": intg.ID},
		bson.M{"$set": bson.M{
			"access_token":     encAccess,
			"token_expires_at": now.Add(time.Duration(expiresIn) * time.Second),
			"updated_at":       now,
			"last_used_at":     now,
		}},
	)
	return err
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

// getClientForProject retrieves a ready-to-use Jira API client for the given project.
// If the stored token expires within 5 minutes, it is refreshed first.
func (svc *Service) getClientForProject(ctx context.Context, projectID primitive.ObjectID) (*Client, error) {
	var intg JiraIntegration
	if err := svc.integrations.FindOne(ctx, bson.M{"project_id": projectID, "is_active": true}).Decode(&intg); err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("no active Jira integration for project %s", projectID.Hex())
		}
		return nil, fmt.Errorf("find integration: %w", err)
	}

	// Refresh proactively if the token expires within 5 minutes.
	if time.Until(intg.TokenExpiresAt) < 5*time.Minute {
		if err := svc.RefreshToken(ctx, projectID); err != nil {
			return nil, fmt.Errorf("proactive token refresh: %w", err)
		}
		// Re-load the integration to get the new encrypted token.
		if err := svc.integrations.FindOne(ctx, bson.M{"_id": intg.ID}).Decode(&intg); err != nil {
			return nil, fmt.Errorf("reload integration after refresh: %w", err)
		}
	}

	accessToken, err := DecryptToken(intg.AccessToken, svc.encKey)
	if err != nil {
		return nil, fmt.Errorf("decrypt access token: %w", err)
	}

	return NewClient(intg.JiraCloudID, accessToken), nil
}

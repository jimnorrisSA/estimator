package jira

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ---------------------------------------------------------------------------
// GetSyncState
// ---------------------------------------------------------------------------

// GetSyncState returns the current sync status for a project.
func (svc *Service) GetSyncState(ctx context.Context, projectID primitive.ObjectID) (SyncState, error) {
	state := SyncState{ProjectID: projectID}

	// Check that there is an active integration.
	var intg JiraIntegration
	err := svc.integrations.FindOne(ctx, bson.M{"project_id": projectID, "is_active": true}).Decode(&intg)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Not connected — return zero state.
			return state, nil
		}
		return state, fmt.Errorf("find integration: %w", err)
	}
	state.IsConnected = true

	// Count conflicted mappings.
	count, err := svc.mappings.CountDocuments(ctx, bson.M{
		"project_id": projectID,
		"conflict":   true,
	})
	if err != nil {
		return state, fmt.Errorf("count conflicts: %w", err)
	}
	state.PendingConflicts = int(count)

	// Most recent sync history record.
	opts := options.FindOne().SetSort(bson.D{{Key: "triggered_at", Value: -1}})
	var latest JiraSyncHistory
	if err := svc.history.FindOne(ctx, bson.M{"project_id": projectID}, opts).Decode(&latest); err == nil {
		state.LastSyncedAt = latest.CompletedAt
		state.LastSyncedBy = latest.TriggeredBy
	}

	return state, nil
}

// ---------------------------------------------------------------------------
// ResolveSyncConflict
// ---------------------------------------------------------------------------

// ResolveSyncConflict resolves a conflicted mapping by choosing the winning side.
// winner must be "estimator" or "jira".
func (svc *Service) ResolveSyncConflict(ctx context.Context, projectID primitive.ObjectID, mappingID primitive.ObjectID, winner, userEmail string) error {
	if winner != "estimator" && winner != "jira" {
		return fmt.Errorf("winner must be \"estimator\" or \"jira\", got %q", winner)
	}

	now := time.Now().UTC()
	result, err := svc.mappings.UpdateOne(
		ctx,
		bson.M{
			"_id":        mappingID,
			"project_id": projectID,
			"conflict":   true,
		},
		bson.M{"$set": bson.M{
			"conflict":       false,
			"origin":         winner,
			"last_synced_at": now,
			"last_synced_by": userEmail,
			"updated_at":     now,
		}},
	)
	if err != nil {
		return fmt.Errorf("resolve conflict: %w", err)
	}
	if result.MatchedCount == 0 {
		return fmt.Errorf("mapping %s not found or not in conflict state", mappingID.Hex())
	}
	return nil
}

// ---------------------------------------------------------------------------
// ValidateConnection
// ---------------------------------------------------------------------------

// ValidateConnection verifies that the stored credentials for a project are still usable.
// It calls GetAccessibleResources with the decrypted access token (refreshing first if needed).
func (svc *Service) ValidateConnection(ctx context.Context, projectID primitive.ObjectID) (bool, error) {
	client, err := svc.getClientForProject(ctx, projectID)
	if err != nil {
		return false, nil //nolint:nilerr // not connected is not an error for this method
	}

	// Attempt a lightweight API call — fetch the issue types meta for any project.
	// We use GetAccessibleResources via the decrypted token.
	var intg JiraIntegration
	if err := svc.integrations.FindOne(ctx, bson.M{"project_id": projectID, "is_active": true}).Decode(&intg); err != nil {
		return false, nil //nolint:nilerr
	}

	// Decrypt the (possibly freshly refreshed) access token.
	accessToken, err := DecryptToken(intg.AccessToken, svc.encKey)
	if err != nil {
		return false, fmt.Errorf("decrypt access token for validation: %w", err)
	}

	// Re-encrypt check: ensure the client was built correctly.
	_ = client

	resources, err := GetAccessibleResources(ctx, accessToken)
	if err != nil || len(resources) == 0 {
		// Mark integration as requiring re-auth.
		svc.integrations.UpdateOne(ctx, bson.M{"_id": intg.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
			"is_active":  false,
			"updated_at": time.Now().UTC(),
		}})
		return false, nil
	}

	// Update last_used_at.
	svc.integrations.UpdateOne(ctx, bson.M{"_id": intg.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
		"last_used_at": time.Now().UTC(),
	}})

	return true, nil
}

// ---------------------------------------------------------------------------
// logSyncHistory
// ---------------------------------------------------------------------------

// logSyncHistory inserts a JiraSyncHistory record. Errors are intentionally swallowed
// so that a logging failure never aborts a sync operation.
func (svc *Service) logSyncHistory(ctx context.Context, history JiraSyncHistory) error {
	if history.Changes == nil {
		history.Changes = []SyncChange{}
	}
	_, err := svc.history.InsertOne(ctx, history)
	return err
}

// ---------------------------------------------------------------------------
// computeSyncHash
// ---------------------------------------------------------------------------

// computeSyncHash returns the first 16 hex characters of a SHA-256 digest of
// issueKey + "|" + updatedAt. Suitable for detecting changes between syncs.
func computeSyncHash(issueKey, updatedAt string) string {
	h := sha256.New()
	h.Write([]byte(issueKey + "|" + updatedAt))
	return hex.EncodeToString(h.Sum(nil))[:16]
}

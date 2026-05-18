package jira

import (
	"context"
	"crypto/md5" //nolint:gosec // MD5 used for change detection only, not security
	"fmt"
	"time"

	"github.com/soulassembly/estimator/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// issueFields is the standard set of fields to request from the Jira search API.
var issueFields = []string{
	"summary", "issuetype", "status", "assignee",
	"customfield_10016", "labels", "duedate", "updated", "parent", "description",
}

// ---------------------------------------------------------------------------
// ImportProject
// ---------------------------------------------------------------------------

// ImportProject imports all epics from a Jira project and their child stories into the
// estimator project. Returns a ProjectImportResult with counts and any non-fatal errors.
func (svc *Service) ImportProject(ctx context.Context, projectID primitive.ObjectID, jiraProjectKey, userEmail string) (ProjectImportResult, error) {
	start := time.Now()
	result := ProjectImportResult{}

	client, err := svc.getClientForProject(ctx, projectID)
	if err != nil {
		return result, err
	}

	// --- Import epics ---
	epicResults, err := svc.importEpicsWithClient(ctx, client, projectID, jiraProjectKey, userEmail)
	if err != nil {
		return result, fmt.Errorf("import epics: %w", err)
	}

	for _, r := range epicResults {
		switch r.Status {
		case "created":
			result.EpicsImported++
			result.MappingsAdded++
		case "updated":
			result.EpicsImported++
		case "error":
			result.Errors = append(result.Errors, fmt.Sprintf("epic %s: %s", r.JiraKey, r.ErrorMessage))
		}
	}

	// --- Import stories under each epic ---
	// Re-fetch all epics to get the keys.
	jql := fmt.Sprintf(`project = "%s" AND issuetype = Epic ORDER BY created ASC`, jiraProjectKey)
	epics, err := client.SearchIssues(ctx, jql, issueFields)
	if err != nil {
		return result, fmt.Errorf("re-fetch epics for stories: %w", err)
	}

	for _, epic := range epics {
		storyResults, err := svc.importStoriesWithClient(ctx, client, projectID, epic.Key, userEmail)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("stories under %s: %v", epic.Key, err))
			continue
		}
		for _, r := range storyResults {
			switch r.Status {
			case "created":
				result.StoriesCreated++
				result.MappingsAdded++
			case "error":
				result.Errors = append(result.Errors, fmt.Sprintf("story %s: %s", r.JiraKey, r.ErrorMessage))
			}
		}
	}

	result.Duration = time.Since(start)

	// Log history.
	stats := SyncStats{
		Created: result.EpicsImported + result.StoriesCreated,
		Errors:  len(result.Errors),
	}
	svc.logSyncHistory(ctx, JiraSyncHistory{ //nolint:errcheck
		ID:          primitive.NewObjectID(),
		ProjectID:   projectID,
		SyncType:    "import",
		Direction:   "jira_to_estimator",
		TriggeredBy: userEmail,
		TriggeredAt: start,
		CompletedAt: time.Now().UTC(),
		Stats:       stats,
		Notes:       fmt.Sprintf("full import of Jira project %s", jiraProjectKey),
	})

	return result, nil
}

// ---------------------------------------------------------------------------
// ImportEpics
// ---------------------------------------------------------------------------

// ImportEpics imports only epics (no stories) from a Jira project.
func (svc *Service) ImportEpics(ctx context.Context, projectID primitive.ObjectID, jiraProjectKey, userEmail string) ([]ImportResult, error) {
	client, err := svc.getClientForProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return svc.importEpicsWithClient(ctx, client, projectID, jiraProjectKey, userEmail)
}

func (svc *Service) importEpicsWithClient(ctx context.Context, client *Client, projectID primitive.ObjectID, jiraProjectKey, userEmail string) ([]ImportResult, error) {
	jql := fmt.Sprintf(`project = "%s" AND issuetype = Epic ORDER BY created ASC`, jiraProjectKey)
	epics, err := client.SearchIssues(ctx, jql, issueFields)
	if err != nil {
		return nil, fmt.Errorf("search epics: %w", err)
	}

	results := make([]ImportResult, 0, len(epics))
	for _, epic := range epics {
		r := svc.upsertFeatureFromEpic(ctx, projectID, epic, userEmail)
		results = append(results, r)
	}
	return results, nil
}

// upsertFeatureFromEpic creates or updates a Feature for a Jira epic.
func (svc *Service) upsertFeatureFromEpic(ctx context.Context, projectID primitive.ObjectID, epic JiraIssue, userEmail string) ImportResult {
	hash := issueSyncHash(epic.Key, epic.Fields.Updated)

	// Check for existing mapping.
	var existing JiraMapping
	err := svc.mappings.FindOne(ctx, bson.M{
		"project_id":   projectID,
		"jira_issue_key": epic.Key,
	}).Decode(&existing)

	if err == nil {
		// Mapping exists — check if anything changed.
		if existing.SyncHash == hash {
			return ImportResult{
				EstimatorID: existing.EstimatorID,
				JiraKey:     epic.Key,
				Status:      "skipped",
				Reason:      "no changes detected",
			}
		}
		// Update the feature name in the project.
		now := time.Now().UTC()
		// EstimatorID is stored as a hex string; convert back to ObjectID for the MongoDB filter.
		existingOID, oidErr := primitive.ObjectIDFromHex(existing.EstimatorID)
		if oidErr != nil {
			return ImportResult{
				EstimatorID:  existing.EstimatorID,
				JiraKey:      epic.Key,
				Status:       "error",
				ErrorMessage: fmt.Sprintf("invalid estimator_id in mapping: %v", oidErr),
			}
		}
		_, updateErr := svc.projects.UpdateOne(
			ctx,
			bson.M{"_id": projectID, "features._id": existingOID},
			bson.M{"$set": bson.M{
				"features.$.name":       JiraIssueToFeatureName(epic),
				"features.$.updated_at": now,
			}},
		)
		if updateErr != nil {
			return ImportResult{
				EstimatorID: existing.EstimatorID,
				JiraKey:     epic.Key,
				Status:      "error",
				ErrorMessage: updateErr.Error(),
			}
		}
		// Update mapping hash.
		svc.mappings.UpdateOne(ctx, bson.M{"_id": existing.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
			"sync_hash":      hash,
			"last_synced_at": now,
			"last_synced_by": userEmail,
			"updated_at":     now,
		}})
		return ImportResult{
			EstimatorID: existing.EstimatorID,
			JiraKey:     epic.Key,
			Status:      "updated",
		}
	}

	if err != mongo.ErrNoDocuments {
		return ImportResult{
			JiraKey:      epic.Key,
			Status:       "error",
			ErrorMessage: fmt.Sprintf("mapping lookup: %v", err),
		}
	}

	// No mapping — create a new Feature.
	featureID := primitive.NewObjectID()
	now := time.Now().UTC()
	feature := models.Feature{
		ID:        featureID,
		ProjectID: projectID,
		Name:      JiraIssueToFeatureName(epic),
		Color:     "#7c3aed",
		PostIts:   []models.PostIt{},
		UpdatedAt: now,
	}

	_, pushErr := svc.projects.UpdateOne(
		ctx,
		bson.M{"_id": projectID},
		bson.M{"$push": bson.M{"features": feature}},
	)
	if pushErr != nil {
		return ImportResult{
			JiraKey:      epic.Key,
			Status:       "error",
			ErrorMessage: fmt.Sprintf("push feature: %v", pushErr),
		}
	}

	mapping := JiraMapping{
		ID:            primitive.NewObjectID(),
		ProjectID:     projectID,
		EstimatorType: "feature",
		EstimatorID:   featureID.Hex(),
		JiraIssueKey:  epic.Key,
		JiraIssueID:   epic.ID,
		JiraIssueType: "epic",
		Direction:     "import",
		Origin:        "jira",
		LastSyncedAt:  now,
		LastSyncedBy:  userEmail,
		SyncHash:      hash,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	svc.mappings.InsertOne(ctx, mapping) //nolint:errcheck

	return ImportResult{
		EstimatorID: featureID.Hex(),
		JiraKey:     epic.Key,
		Status:      "created",
	}
}

// ---------------------------------------------------------------------------
// ImportStories
// ---------------------------------------------------------------------------

// ImportStories imports stories under a specific epic key.
func (svc *Service) ImportStories(ctx context.Context, projectID primitive.ObjectID, epicKey, userEmail string) ([]ImportResult, error) {
	client, err := svc.getClientForProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return svc.importStoriesWithClient(ctx, client, projectID, epicKey, userEmail)
}

func (svc *Service) importStoriesWithClient(ctx context.Context, client *Client, projectID primitive.ObjectID, epicKey, userEmail string) ([]ImportResult, error) {
	// Find the feature that maps to this epic so we know which featureID to use.
	var epicMapping JiraMapping
	err := svc.mappings.FindOne(ctx, bson.M{
		"project_id":    projectID,
		"jira_issue_key": epicKey,
		"estimator_type": "feature",
	}).Decode(&epicMapping)
	if err != nil {
		return nil, fmt.Errorf("find feature mapping for epic %s: %w", epicKey, err)
	}

	// Search for stories in this epic. Jira's "Epic Link" field varies; use parent-link JQL.
	jql := fmt.Sprintf(`"Epic Link" = "%s" OR parent = "%s" ORDER BY created ASC`, epicKey, epicKey)
	stories, err := client.SearchIssues(ctx, jql, issueFields)
	if err != nil {
		return nil, fmt.Errorf("search stories under %s: %w", epicKey, err)
	}

	// EstimatorID is stored as a hex string; convert back to ObjectID for the feature reference.
	featureOID, err := primitive.ObjectIDFromHex(epicMapping.EstimatorID)
	if err != nil {
		return nil, fmt.Errorf("invalid feature estimator_id in mapping for epic %s: %w", epicKey, err)
	}

	results := make([]ImportResult, 0, len(stories))
	for _, story := range stories {
		r := svc.upsertPostItFromStory(ctx, projectID, featureOID, story, userEmail)
		results = append(results, r)
	}
	return results, nil
}

// upsertPostItFromStory creates or updates a PostIt for a Jira story.
func (svc *Service) upsertPostItFromStory(ctx context.Context, projectID, featureID primitive.ObjectID, story JiraIssue, userEmail string) ImportResult {
	hash := issueSyncHash(story.Key, story.Fields.Updated)

	// Check for existing mapping.
	var existing JiraMapping
	err := svc.mappings.FindOne(ctx, bson.M{
		"project_id":    projectID,
		"jira_issue_key": story.Key,
	}).Decode(&existing)

	if err == nil {
		if existing.SyncHash == hash {
			return ImportResult{
				EstimatorID: existing.EstimatorID,
				JiraKey:     story.Key,
				Status:      "skipped",
				Reason:      "no changes detected",
			}
		}
		// Update the postit label/estimate.
		size := "M"
		if story.Fields.StoryPoints != nil {
			size = StoryPointsToTShirtSize(*story.Fields.StoryPoints)
		}
		now := time.Now().UTC()
		// EstimatorID is stored as a hex string; convert back to ObjectID for the MongoDB filter.
		existingOID, oidErr := primitive.ObjectIDFromHex(existing.EstimatorID)
		if oidErr != nil {
			return ImportResult{
				EstimatorID:  existing.EstimatorID,
				JiraKey:      story.Key,
				Status:       "error",
				ErrorMessage: fmt.Sprintf("invalid estimator_id in mapping: %v", oidErr),
			}
		}
		_, updateErr := svc.projects.UpdateOne(
			ctx,
			bson.M{"_id": projectID, "features.postits._id": existingOID},
			bson.M{"$set": bson.M{
				"features.$.postits.$[postit].task_label":       story.Fields.Summary,
				"features.$.postits.$[postit].estimate.value":   TShirtSizeToStoryPoints(size),
				"features.$.postits.$[postit].updated_at":       now,
				"features.$.postits.$[postit].updated_by":       userEmail,
			}},
		)
		if updateErr != nil {
			// Array filters require a different update path; fall back to a simpler update.
			svc.projects.UpdateOne(
				ctx,
				bson.M{"_id": projectID, "features._id": featureID},
				bson.M{"$set": bson.M{
					"features.$.updated_at": now,
				}},
			) //nolint:errcheck
		}
		svc.mappings.UpdateOne(ctx, bson.M{"_id": existing.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
			"sync_hash":      hash,
			"last_synced_at": now,
			"last_synced_by": userEmail,
			"updated_at":     now,
		}})
		return ImportResult{
			EstimatorID: existing.EstimatorID,
			JiraKey:     story.Key,
			Status:      "updated",
		}
	}

	if err != mongo.ErrNoDocuments {
		return ImportResult{
			JiraKey:      story.Key,
			Status:       "error",
			ErrorMessage: fmt.Sprintf("mapping lookup: %v", err),
		}
	}

	// No mapping — create a new PostIt.
	size := "M"
	if story.Fields.StoryPoints != nil {
		size = StoryPointsToTShirtSize(*story.Fields.StoryPoints)
	}

	postitID := primitive.NewObjectID()
	now := time.Now().UTC()
	postit := models.PostIt{
		ID:         postitID,
		FeatureID:  featureID,
		Discipline: models.Discipline(JiraIssueToDiscipline(story)),
		Color:      "#a78bfa",
		TaskLabel:  story.Fields.Summary,
		Estimate: models.Estimate{
			Value: TShirtSizeToStoryPoints(size),
			Unit:  models.UnitDay,
		},
		UpdatedAt: now,
		UpdatedBy: userEmail,
	}

	_, pushErr := svc.projects.UpdateOne(
		ctx,
		bson.M{"_id": projectID, "features._id": featureID},
		bson.M{"$push": bson.M{"features.$.postits": postit}},
	)
	if pushErr != nil {
		return ImportResult{
			JiraKey:      story.Key,
			Status:       "error",
			ErrorMessage: fmt.Sprintf("push postit: %v", pushErr),
		}
	}

	mapping := JiraMapping{
		ID:            primitive.NewObjectID(),
		ProjectID:     projectID,
		EstimatorType: "task",
		EstimatorID:   postitID.Hex(),
		JiraIssueKey:  story.Key,
		JiraIssueID:   story.ID,
		JiraIssueType: "story",
		Direction:     "import",
		Origin:        "jira",
		LastSyncedAt:  now,
		LastSyncedBy:  userEmail,
		SyncHash:      hash,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	svc.mappings.InsertOne(ctx, mapping) //nolint:errcheck

	return ImportResult{
		EstimatorID: postitID.Hex(),
		JiraKey:     story.Key,
		Status:      "created",
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// issueSyncHash returns an MD5 hex digest of issueKey + "|" + updatedAt.
// Used to detect whether a Jira issue has changed since last sync.
func issueSyncHash(issueKey, updatedAt string) string {
	h := md5.New() //nolint:gosec
	h.Write([]byte(issueKey + "|" + updatedAt))
	return fmt.Sprintf("%x", h.Sum(nil))
}

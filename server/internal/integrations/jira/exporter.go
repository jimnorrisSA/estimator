package jira

import (
	"context"
	"fmt"
	"time"

	"github.com/soulassembly/estimator/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ---------------------------------------------------------------------------
// ExportEstimates
// ---------------------------------------------------------------------------

// ExportEstimates pushes T-shirt-size estimates for the given features to Jira.
// If featureIDs is empty, all features in the project are exported.
func (svc *Service) ExportEstimates(ctx context.Context, projectID primitive.ObjectID, featureIDs []primitive.ObjectID, notes, userEmail string) ([]ExportResult, error) {
	start := time.Now()

	client, err := svc.getClientForProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	// Load the project.
	project, err := svc.loadProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	// Build a set of requested IDs (empty = all).
	wantAll := len(featureIDs) == 0
	wantSet := make(map[primitive.ObjectID]bool, len(featureIDs))
	for _, id := range featureIDs {
		wantSet[id] = true
	}

	var results []ExportResult
	var changes []SyncChange

	for _, feature := range project.Features {
		if !wantAll && !wantSet[feature.ID] {
			continue
		}

		r := svc.exportFeatureWithClient(ctx, client, project, feature, userEmail)
		results = append(results, r)
		changes = append(changes, SyncChange{
			EstimatorID: feature.ID,
			JiraKey:     r.JiraKey,
			Action:      r.Status,
			Reason:      r.Reason,
			ErrorMessage: r.ErrorMessage,
		})
	}

	// Count stats.
	stats := SyncStats{}
	for _, r := range results {
		switch r.Status {
		case "created":
			stats.Created++
		case "updated":
			stats.Updated++
		case "skipped":
			stats.Skipped++
		case "error":
			stats.Errors++
		}
	}

	svc.logSyncHistory(ctx, JiraSyncHistory{ //nolint:errcheck
		ID:          primitive.NewObjectID(),
		ProjectID:   projectID,
		SyncType:    "export",
		Direction:   "estimator_to_jira",
		TriggeredBy: userEmail,
		TriggeredAt: start,
		CompletedAt: time.Now().UTC(),
		Stats:       stats,
		Changes:     changes,
		Notes:       notes,
	})

	return results, nil
}

// ---------------------------------------------------------------------------
// ExportFeature
// ---------------------------------------------------------------------------

// ExportFeature exports a single feature to Jira as an Epic.
func (svc *Service) ExportFeature(ctx context.Context, projectID, featureID primitive.ObjectID, userEmail string) (ExportResult, error) {
	client, err := svc.getClientForProject(ctx, projectID)
	if err != nil {
		return ExportResult{}, err
	}

	project, err := svc.loadProject(ctx, projectID)
	if err != nil {
		return ExportResult{}, err
	}

	feature, ok := findFeature(project, featureID)
	if !ok {
		return ExportResult{}, fmt.Errorf("feature %s not found in project", featureID.Hex())
	}

	result := svc.exportFeatureWithClient(ctx, client, project, feature, userEmail)

	svc.logSyncHistory(ctx, JiraSyncHistory{ //nolint:errcheck
		ID:          primitive.NewObjectID(),
		ProjectID:   projectID,
		SyncType:    "export",
		Direction:   "estimator_to_jira",
		TriggeredBy: userEmail,
		TriggeredAt: time.Now().UTC(),
		CompletedAt: time.Now().UTC(),
		Stats: SyncStats{
			Created: boolToInt(result.Status == "created"),
			Updated: boolToInt(result.Status == "updated"),
			Errors:  boolToInt(result.Status == "error"),
		},
		Changes: []SyncChange{{
			EstimatorID:  feature.ID,
			JiraKey:      result.JiraKey,
			Action:       result.Status,
			Reason:       result.Reason,
			ErrorMessage: result.ErrorMessage,
		}},
	})

	return result, nil
}

// exportFeatureWithClient is the shared implementation for exporting a feature.
func (svc *Service) exportFeatureWithClient(ctx context.Context, client *Client, project models.Project, feature models.Feature, userEmail string) ExportResult {
	// Load integration to get Jira project key.
	var intg JiraIntegration
	if err := svc.integrations.FindOne(ctx, bson.M{"project_id": project.ID, "is_active": true}).Decode(&intg); err != nil {
		return ExportResult{
			EstimatorID:  feature.ID,
			Status:       "error",
			ErrorMessage: fmt.Sprintf("load integration: %v", err),
		}
	}

	// Check for existing mapping.
	var mapping JiraMapping
	err := svc.mappings.FindOne(ctx, bson.M{
		"project_id":    project.ID,
		"estimator_id":  feature.ID,
		"estimator_type": "feature",
	}).Decode(&mapping)

	now := time.Now().UTC()

	// Build estimate data from postits.
	tshirtSize, cost, disciplines := aggregateFeatureEstimates(feature)

	if err == nil {
		// Update existing Jira issue.
		fields := BuildEstimateUpdateBody(tshirtSize, cost, disciplines)
		fields["summary"] = feature.Name
		if updateErr := client.UpdateIssue(ctx, mapping.JiraIssueKey, fields); updateErr != nil {
			return ExportResult{
				EstimatorID:  feature.ID,
				JiraKey:      mapping.JiraIssueKey,
				Status:       "error",
				ErrorMessage: updateErr.Error(),
			}
		}
		svc.mappings.UpdateOne(ctx, bson.M{"_id": mapping.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
			"last_synced_at": now,
			"last_synced_by": userEmail,
			"updated_at":     now,
		}})
		return ExportResult{
			EstimatorID: feature.ID,
			JiraKey:     mapping.JiraIssueKey,
			Status:      "updated",
		}
	}

	if err != mongo.ErrNoDocuments {
		return ExportResult{
			EstimatorID:  feature.ID,
			Status:       "error",
			ErrorMessage: fmt.Sprintf("mapping lookup: %v", err),
		}
	}

	// No mapping — create a new Epic in Jira.
	if intg.JiraProjectKey == "" {
		return ExportResult{
			EstimatorID:  feature.ID,
			Status:       "skipped",
			Reason:       "no jira_project_key configured on integration — cannot create new issues",
		}
	}

	storyPoints := TShirtSizeToStoryPoints(tshirtSize)
	body := BuildJiraIssueBody(intg.JiraProjectKey, "Epic", feature.Name, storyPoints)
	created, createErr := client.CreateIssue(ctx, body)
	if createErr != nil {
		return ExportResult{
			EstimatorID:  feature.ID,
			Status:       "error",
			ErrorMessage: createErr.Error(),
		}
	}

	newMapping := JiraMapping{
		ID:            primitive.NewObjectID(),
		ProjectID:     project.ID,
		EstimatorType: "feature",
		EstimatorID:   feature.ID,
		JiraIssueKey:  created.Key,
		JiraIssueID:   created.ID,
		JiraIssueType: "epic",
		Direction:     "export",
		Origin:        "estimator",
		LastSyncedAt:  now,
		LastSyncedBy:  userEmail,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	svc.mappings.InsertOne(ctx, newMapping) //nolint:errcheck

	return ExportResult{
		EstimatorID: feature.ID,
		JiraKey:     created.Key,
		Status:      "created",
	}
}

// ---------------------------------------------------------------------------
// ExportTask
// ---------------------------------------------------------------------------

// ExportTask exports a single task (PostIt) to Jira as a Story.
func (svc *Service) ExportTask(ctx context.Context, projectID, taskID primitive.ObjectID, userEmail string) (ExportResult, error) {
	client, err := svc.getClientForProject(ctx, projectID)
	if err != nil {
		return ExportResult{}, err
	}

	project, err := svc.loadProject(ctx, projectID)
	if err != nil {
		return ExportResult{}, err
	}

	// Load integration for project key.
	var intg JiraIntegration
	if err := svc.integrations.FindOne(ctx, bson.M{"project_id": projectID, "is_active": true}).Decode(&intg); err != nil {
		return ExportResult{}, fmt.Errorf("load integration: %w", err)
	}

	postit, parentFeature, ok := findPostIt(project, taskID)
	if !ok {
		return ExportResult{}, fmt.Errorf("task %s not found in project", taskID.Hex())
	}

	now := time.Now().UTC()
	tshirtSize := StoryPointsToTShirtSize(postit.Estimate.Value)

	// Find the parent epic's Jira key (if it has one) so we can set the parent link.
	var epicKey string
	var epicMapping JiraMapping
	if mapErr := svc.mappings.FindOne(ctx, bson.M{
		"project_id":    projectID,
		"estimator_id":  parentFeature.ID,
		"estimator_type": "feature",
	}).Decode(&epicMapping); mapErr == nil {
		epicKey = epicMapping.JiraIssueKey
	}

	// Check for existing story mapping.
	var mapping JiraMapping
	err = svc.mappings.FindOne(ctx, bson.M{
		"project_id":    projectID,
		"estimator_id":  taskID,
		"estimator_type": "task",
	}).Decode(&mapping)

	if err == nil {
		// Update existing story.
		fields := map[string]interface{}{
			"summary":           postit.TaskLabel,
			"customfield_10016": TShirtSizeToStoryPoints(tshirtSize),
		}
		if updateErr := client.UpdateIssue(ctx, mapping.JiraIssueKey, fields); updateErr != nil {
			return ExportResult{
				EstimatorID:  taskID,
				JiraKey:      mapping.JiraIssueKey,
				Status:       "error",
				ErrorMessage: updateErr.Error(),
			}, nil
		}
		svc.mappings.UpdateOne(ctx, bson.M{"_id": mapping.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
			"last_synced_at": now,
			"last_synced_by": userEmail,
			"updated_at":     now,
		}})
		return ExportResult{
			EstimatorID: taskID,
			JiraKey:     mapping.JiraIssueKey,
			Status:      "updated",
		}, nil
	}

	if err != mongo.ErrNoDocuments {
		return ExportResult{
			EstimatorID:  taskID,
			Status:       "error",
			ErrorMessage: fmt.Sprintf("mapping lookup: %v", err),
		}, nil
	}

	if intg.JiraProjectKey == "" {
		return ExportResult{
			EstimatorID: taskID,
			Status:      "skipped",
			Reason:      "no jira_project_key configured — cannot create new story",
		}, nil
	}

	storyPoints := TShirtSizeToStoryPoints(tshirtSize)
	body := BuildJiraIssueBody(intg.JiraProjectKey, "Story", postit.TaskLabel, storyPoints)

	// Attach parent epic if known.
	if epicKey != "" {
		if fields, ok := body["fields"].(map[string]interface{}); ok {
			fields["parent"] = map[string]string{"key": epicKey}
		}
	}

	created, createErr := client.CreateIssue(ctx, body)
	if createErr != nil {
		return ExportResult{
			EstimatorID:  taskID,
			Status:       "error",
			ErrorMessage: createErr.Error(),
		}, nil
	}

	newMapping := JiraMapping{
		ID:            primitive.NewObjectID(),
		ProjectID:     projectID,
		EstimatorType: "task",
		EstimatorID:   taskID,
		JiraIssueKey:  created.Key,
		JiraIssueID:   created.ID,
		JiraIssueType: "story",
		Direction:     "export",
		Origin:        "estimator",
		LastSyncedAt:  now,
		LastSyncedBy:  userEmail,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	svc.mappings.InsertOne(ctx, newMapping) //nolint:errcheck

	return ExportResult{
		EstimatorID: taskID,
		JiraKey:     created.Key,
		Status:      "created",
	}, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// loadProject fetches a project document from MongoDB.
func (svc *Service) loadProject(ctx context.Context, projectID primitive.ObjectID) (models.Project, error) {
	var project models.Project
	if err := svc.projects.FindOne(ctx, bson.M{"_id": projectID}).Decode(&project); err != nil {
		if err == mongo.ErrNoDocuments {
			return project, fmt.Errorf("project %s not found", projectID.Hex())
		}
		return project, fmt.Errorf("load project: %w", err)
	}
	return project, nil
}

// findFeature returns the Feature with the given ID from a project.
func findFeature(project models.Project, featureID primitive.ObjectID) (models.Feature, bool) {
	for _, f := range project.Features {
		if f.ID == featureID {
			return f, true
		}
	}
	return models.Feature{}, false
}

// findPostIt returns the PostIt and its parent Feature from a project.
func findPostIt(project models.Project, taskID primitive.ObjectID) (models.PostIt, models.Feature, bool) {
	for _, f := range project.Features {
		for _, p := range f.PostIts {
			if p.ID == taskID {
				return p, f, true
			}
		}
	}
	return models.PostIt{}, models.Feature{}, false
}

// aggregateFeatureEstimates computes the representative T-shirt size, a mock cost,
// and per-discipline day totals for a feature.
func aggregateFeatureEstimates(feature models.Feature) (tshirtSize string, cost float64, disciplines map[string]float64) {
	disciplines = make(map[string]float64)
	totalPoints := 0.0
	for _, p := range feature.PostIts {
		days := p.Estimate.Value * models.WorkingDays[p.Estimate.Unit]
		disciplines[string(p.Discipline)] += days
		totalPoints += p.Estimate.Value
	}
	if len(feature.PostIts) == 0 {
		tshirtSize = "M"
	} else {
		avg := totalPoints / float64(len(feature.PostIts))
		tshirtSize = StoryPointsToTShirtSize(avg)
	}
	// Cost is a stub — real calculation requires roster rates.
	cost = totalPoints * 800
	return
}

// boolToInt converts a bool to 0 or 1.
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

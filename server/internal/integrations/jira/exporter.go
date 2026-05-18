package jira

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/soulassembly/estimator/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ---------------------------------------------------------------------------
// Snapshot types — mirror the client-side feature structure stored in project.Snapshot
// ---------------------------------------------------------------------------

// snapshotFeature mirrors the client-side Feature stored in project.snapshot.features.
type snapshotFeature struct {
	ID     string          `json:"id"`
	Name   string          `json:"name"`
	Groups []snapshotGroup `json:"groups"`
}

type snapshotGroup struct {
	Discipline string         `json:"discipline"`
	Tasks      []snapshotTask `json:"tasks"`
}

type snapshotTask struct {
	ID       string           `json:"id"`
	Label    string           `json:"label"`
	Estimate snapshotEstimate `json:"estimate"`
}

type snapshotEstimate struct {
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
}

var snapshotWorkingDays = map[string]float64{
	"half_day": 0.5,
	"day":      1,
	"week":     5,
	"month":    20,
}

// featuresFromSnapshot extracts features from the client's snapshot blob.
func featuresFromSnapshot(snapshot interface{}) []snapshotFeature {
	if snapshot == nil {
		return nil
	}
	b, err := json.Marshal(snapshot)
	if err != nil {
		return nil
	}
	var s struct {
		Features []snapshotFeature `json:"features"`
	}
	if err := json.Unmarshal(b, &s); err != nil {
		return nil
	}
	return s.Features
}

// aggregateSnapshotFeature computes T-shirt size and cost from a snapshot feature's tasks.
func aggregateSnapshotFeature(f snapshotFeature) (tshirtSize string, cost float64, disciplines map[string]float64) {
	disciplines = make(map[string]float64)
	total := 0.0
	count := 0
	for _, g := range f.Groups {
		for _, t := range g.Tasks {
			days := t.Estimate.Value * snapshotWorkingDays[t.Estimate.Unit]
			disciplines[g.Discipline] += days
			total += days
			count++
		}
	}
	if count == 0 {
		tshirtSize = "M"
	} else {
		avg := total / float64(count)
		tshirtSize = StoryPointsToTShirtSize(avg)
	}
	cost = total * 800
	return
}

// ---------------------------------------------------------------------------
// ExportEstimates
// ---------------------------------------------------------------------------

// ExportEstimates pushes T-shirt-size estimates for the given features to Jira.
// If featureIDs is empty, all features in the project are exported.
func (svc *Service) ExportEstimates(ctx context.Context, projectID primitive.ObjectID, featureIDs []string, notes, userEmail string) ([]ExportResult, error) {
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

	// Build filter set (empty = all).
	wantAll := len(featureIDs) == 0
	wantSet := make(map[string]bool, len(featureIDs))
	for _, id := range featureIDs {
		wantSet[id] = true
	}

	var results []ExportResult
	var changes []SyncChange

	if len(project.Features) > 0 {
		// Structured features path.
		for _, feature := range project.Features {
			fid := feature.ID.Hex()
			if !wantAll && !wantSet[fid] {
				continue
			}
			r := svc.exportFeatureWithClient(ctx, client, project, feature, userEmail)
			results = append(results, r)
			changes = append(changes, SyncChange{
				EstimatorID:  r.EstimatorID,
				JiraKey:      r.JiraKey,
				Action:       r.Status,
				Reason:       r.Reason,
				ErrorMessage: r.ErrorMessage,
			})
		}
	} else {
		// Snapshot features path — used by the current client.
		snapshotFeats := featuresFromSnapshot(project.Snapshot)
		var intg JiraIntegration
		if err := svc.integrations.FindOne(ctx, bson.M{"project_id": projectID, "is_active": true}).Decode(&intg); err != nil {
			return nil, fmt.Errorf("load integration: %w", err)
		}
		for _, f := range snapshotFeats {
			if !wantAll && !wantSet[f.ID] {
				continue
			}
			for _, r := range svc.exportSnapshotFeatureWithClient(ctx, client, projectID, intg, f, userEmail) {
				results = append(results, r)
				changes = append(changes, SyncChange{
					EstimatorID:  r.EstimatorID,
					JiraKey:      r.JiraKey,
					Action:       r.Status,
					Reason:       r.Reason,
					ErrorMessage: r.ErrorMessage,
				})
			}
		}
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
			EstimatorID:  feature.ID.Hex(),
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
			EstimatorID:  feature.ID.Hex(),
			Status:       "error",
			ErrorMessage: fmt.Sprintf("load integration: %v", err),
		}
	}

	// Check for existing mapping.
	var mapping JiraMapping
	err := svc.mappings.FindOne(ctx, bson.M{
		"project_id":    project.ID,
		"estimator_id":  feature.ID.Hex(),
		"estimator_type": "feature",
	}).Decode(&mapping)

	now := time.Now().UTC()

	// Build estimate data from postits.
	tshirtSize, cost, disciplines := aggregateFeatureEstimates(feature)

	staleMapping := false
	if err == nil {
		// Update existing Jira issue.
		fields := BuildEstimateUpdateBody(tshirtSize, cost, disciplines)
		fields["summary"] = feature.Name
		if updateErr := client.UpdateIssue(ctx, mapping.JiraIssueKey, fields); updateErr != nil {
			if strings.Contains(updateErr.Error(), "404") {
				// Issue deleted in Jira — drop the stale mapping and create a fresh one below.
				svc.mappings.DeleteOne(ctx, bson.M{"_id": mapping.ID}) //nolint:errcheck
				staleMapping = true
			} else {
				return ExportResult{
					EstimatorID:  feature.ID.Hex(),
					JiraKey:      mapping.JiraIssueKey,
					Status:       "error",
					ErrorMessage: updateErr.Error(),
				}
			}
		} else {
			svc.mappings.UpdateOne(ctx, bson.M{"_id": mapping.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
				"last_synced_at": now,
				"last_synced_by": userEmail,
				"updated_at":     now,
			}})
			return ExportResult{
				EstimatorID: feature.ID.Hex(),
				JiraKey:     mapping.JiraIssueKey,
				Status:      "updated",
			}
		}
	}

	if err != mongo.ErrNoDocuments && !staleMapping {
		return ExportResult{
			EstimatorID:  feature.ID.Hex(),
			Status:       "error",
			ErrorMessage: fmt.Sprintf("mapping lookup: %v", err),
		}
	}

	// No mapping — create a new Epic in Jira.
	if intg.JiraProjectKey == "" {
		return ExportResult{
			EstimatorID:  feature.ID.Hex(),
			Status:       "skipped",
			Reason:       "no jira_project_key configured on integration — cannot create new issues",
		}
	}

	storyPoints := TShirtSizeToStoryPoints(tshirtSize)
	body := BuildJiraIssueBody(intg.JiraProjectKey, "Epic", feature.Name, storyPoints)
	created, createErr := client.CreateIssue(ctx, body)
	if createErr != nil {
		return ExportResult{
			EstimatorID:  feature.ID.Hex(),
			Status:       "error",
			ErrorMessage: createErr.Error(),
		}
	}

	newMapping := JiraMapping{
		ID:            primitive.NewObjectID(),
		ProjectID:     project.ID,
		EstimatorType: "feature",
		EstimatorID:   feature.ID.Hex(),
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
		EstimatorID: feature.ID.Hex(),
		JiraKey:     created.Key,
		Status:      "created",
	}
}

// exportSnapshotFeatureWithClient exports a snapshot feature as a Jira Epic and its tasks as Stories.
// Returns one result per item (first entry is the Epic, remaining are Stories).
func (svc *Service) exportSnapshotFeatureWithClient(ctx context.Context, client *Client, projectID primitive.ObjectID, intg JiraIntegration, f snapshotFeature, userEmail string) []ExportResult {
	tshirtSize, cost, disciplines := aggregateSnapshotFeature(f)

	var mapping JiraMapping
	err := svc.mappings.FindOne(ctx, bson.M{
		"project_id":     projectID,
		"estimator_id":   f.ID,
		"estimator_type": "feature",
	}).Decode(&mapping)

	now := time.Now().UTC()
	var epicKey string
	var epicResult ExportResult

	if err == nil {
		// Update existing Epic.
		fields := BuildEstimateUpdateBody(tshirtSize, cost, disciplines)
		fields["summary"] = f.Name
		if updateErr := client.UpdateIssue(ctx, mapping.JiraIssueKey, fields); updateErr != nil {
			return []ExportResult{{EstimatorID: f.ID, JiraKey: mapping.JiraIssueKey, Status: "error", ErrorMessage: updateErr.Error()}}
		}
		svc.mappings.UpdateOne(ctx, bson.M{"_id": mapping.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
			"last_synced_at": now,
			"last_synced_by": userEmail,
			"updated_at":     now,
		}})
		epicKey = mapping.JiraIssueKey
		epicResult = ExportResult{EstimatorID: f.ID, JiraKey: epicKey, Status: "updated"}
	} else if err != mongo.ErrNoDocuments {
		return []ExportResult{{EstimatorID: f.ID, Status: "error", ErrorMessage: fmt.Sprintf("mapping lookup: %v", err)}}
	} else {
		// Create new Epic.
		if intg.JiraProjectKey == "" {
			return []ExportResult{{EstimatorID: f.ID, Status: "skipped", Reason: "no jira_project_key configured — cannot create new issues"}}
		}
		body := BuildJiraIssueBody(intg.JiraProjectKey, "Epic", f.Name, 0)
		created, createErr := client.CreateIssue(ctx, body)
		if createErr != nil {
			return []ExportResult{{EstimatorID: f.ID, Status: "error", ErrorMessage: createErr.Error()}}
		}
		svc.mappings.InsertOne(ctx, JiraMapping{ //nolint:errcheck
			ID:            primitive.NewObjectID(),
			ProjectID:     projectID,
			EstimatorType: "feature",
			EstimatorID:   f.ID,
			JiraIssueKey:  created.Key,
			JiraIssueID:   created.ID,
			JiraIssueType: "epic",
			Direction:     "export",
			Origin:        "estimator",
			LastSyncedAt:  now,
			LastSyncedBy:  userEmail,
			CreatedAt:     now,
			UpdatedAt:     now,
		})
		epicKey = created.Key
		epicResult = ExportResult{EstimatorID: f.ID, JiraKey: epicKey, Status: "created"}
	}

	results := []ExportResult{epicResult}

	// Export each task as a Story linked to the Epic.
	for _, g := range f.Groups {
		for _, t := range g.Tasks {
			r := svc.exportSnapshotTaskWithClient(ctx, client, projectID, intg, t, g.Discipline, epicKey, userEmail)
			results = append(results, r)
		}
	}
	return results
}

// exportSnapshotTaskWithClient exports a single snapshot task as a Jira Story linked to the given Epic.
func (svc *Service) exportSnapshotTaskWithClient(ctx context.Context, client *Client, projectID primitive.ObjectID, intg JiraIntegration, t snapshotTask, discipline, epicKey, userEmail string) ExportResult {
	var mapping JiraMapping
	err := svc.mappings.FindOne(ctx, bson.M{
		"project_id":     projectID,
		"estimator_id":   t.ID,
		"estimator_type": "task",
	}).Decode(&mapping)

	now := time.Now().UTC()

	if err == nil {
		// Update existing Story.
		summary := "[" + discipline + "] " + t.Label
		if updateErr := client.UpdateIssue(ctx, mapping.JiraIssueKey, map[string]interface{}{
			"summary": summary,
		}); updateErr != nil {
			return ExportResult{EstimatorID: t.ID, JiraKey: mapping.JiraIssueKey, Status: "error", ErrorMessage: updateErr.Error()}
		}
		svc.mappings.UpdateOne(ctx, bson.M{"_id": mapping.ID}, bson.M{"$set": bson.M{ //nolint:errcheck
			"last_synced_at": now,
			"last_synced_by": userEmail,
			"updated_at":     now,
		}})
		return ExportResult{EstimatorID: t.ID, JiraKey: mapping.JiraIssueKey, Status: "updated"}
	}

	if err != mongo.ErrNoDocuments {
		return ExportResult{EstimatorID: t.ID, Status: "error", ErrorMessage: fmt.Sprintf("task mapping lookup: %v", err)}
	}

	// Create new Task — discipline prefix in summary gives context in Jira.
	// Include both Epic Link approaches in the create body:
	//   customfield_10014 = classic company-managed projects
	//   parent            = next-gen team-managed projects
	// Jira ignores fields it doesn't recognise for the project type.
	summary := "[" + discipline + "] " + t.Label
	body := BuildJiraIssueBody(intg.JiraProjectKey, "Task", summary, 0)
	if epicKey != "" {
		if fields, ok := body["fields"].(map[string]interface{}); ok {
			fields["customfield_10014"] = epicKey
			fields["parent"] = map[string]string{"key": epicKey}
		}
	}
	created, createErr := client.CreateIssue(ctx, body)
	if createErr != nil {
		// If create with parent fields failed, retry with just the essentials.
		body = BuildJiraIssueBody(intg.JiraProjectKey, "Task", summary, 0)
		created, createErr = client.CreateIssue(ctx, body)
		if createErr != nil {
			return ExportResult{EstimatorID: t.ID, Status: "error", ErrorMessage: createErr.Error()}
		}
	}
	svc.mappings.InsertOne(ctx, JiraMapping{ //nolint:errcheck
		ID:            primitive.NewObjectID(),
		ProjectID:     projectID,
		EstimatorType: "task",
		EstimatorID:   t.ID,
		JiraIssueKey:  created.Key,
		JiraIssueID:   created.ID,
		JiraIssueType: "story",
		Direction:     "export",
		Origin:        "estimator",
		LastSyncedAt:  now,
		LastSyncedBy:  userEmail,
		CreatedAt:     now,
		UpdatedAt:     now,
	})
	return ExportResult{EstimatorID: t.ID, JiraKey: created.Key, Status: "created"}
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
				EstimatorID:  taskID.Hex(),
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
			EstimatorID: taskID.Hex(),
			JiraKey:     mapping.JiraIssueKey,
			Status:      "updated",
		}, nil
	}

	if err != mongo.ErrNoDocuments {
		return ExportResult{
			EstimatorID:  taskID.Hex(),
			Status:       "error",
			ErrorMessage: fmt.Sprintf("mapping lookup: %v", err),
		}, nil
	}

	if intg.JiraProjectKey == "" {
		return ExportResult{
			EstimatorID: taskID.Hex(),
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
			EstimatorID:  taskID.Hex(),
			Status:       "error",
			ErrorMessage: createErr.Error(),
		}, nil
	}

	newMapping := JiraMapping{
		ID:            primitive.NewObjectID(),
		ProjectID:     projectID,
		EstimatorType: "task",
		EstimatorID:   taskID.Hex(),
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
		EstimatorID: taskID.Hex(),
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

package jira

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ---------------------------------------------------------------------------
// MongoDB document types
// ---------------------------------------------------------------------------

// JiraIntegration is stored in the "jira_integrations" collection.
type JiraIntegration struct {
	ID               primitive.ObjectID `bson:"_id"                json:"id"`
	ProjectID        primitive.ObjectID `bson:"project_id"         json:"projectId"`
	UserID           string             `bson:"user_id"            json:"userId"` // email
	JiraInstanceURL  string             `bson:"jira_instance_url"  json:"jiraInstanceUrl"`
	JiraCloudID      string             `bson:"jira_cloud_id"      json:"jiraCloudId"`
	JiraProjectKey   string             `bson:"jira_project_key"   json:"jiraProjectKey"`
	AccessToken      string             `bson:"access_token"       json:"-"` // AES-GCM encrypted, hex-encoded
	RefreshToken     string             `bson:"refresh_token"      json:"-"` // AES-GCM encrypted, hex-encoded
	TokenExpiresAt   time.Time          `bson:"token_expires_at"   json:"tokenExpiresAt"`
	Scope            []string           `bson:"scope"              json:"scope"`
	IsActive         bool               `bson:"is_active"          json:"isActive"`
	CreatedAt        time.Time          `bson:"created_at"         json:"createdAt"`
	UpdatedAt        time.Time          `bson:"updated_at"         json:"updatedAt"`
	LastUsedAt       time.Time          `bson:"last_used_at"       json:"lastUsedAt"`
}

// JiraMapping is stored in the "jira_mappings" collection.
// EstimatorType is "feature" or "task".
// Direction is "import", "export", or "bi-directional".
// Origin is "estimator" or "jira".
type JiraMapping struct {
	ID             primitive.ObjectID `bson:"_id"              json:"id"`
	ProjectID      primitive.ObjectID `bson:"project_id"       json:"projectId"`
	EstimatorType  string             `bson:"estimator_type"   json:"estimatorType"` // "feature" | "task"
	EstimatorID    string             `bson:"estimator_id"     json:"estimatorId"`
	JiraIssueKey   string             `bson:"jira_issue_key"   json:"jiraIssueKey"`   // e.g. "DANCE-42"
	JiraIssueID    string             `bson:"jira_issue_id"    json:"jiraIssueId"`
	JiraIssueType  string             `bson:"jira_issue_type"  json:"jiraIssueType"` // "epic" | "story" | "task"
	Direction      string             `bson:"direction"        json:"direction"`      // "import" | "export" | "bi-directional"
	Origin         string             `bson:"origin"           json:"origin"`         // "estimator" | "jira"
	Conflict       bool               `bson:"conflict"         json:"conflict"`
	LastSyncedAt   time.Time          `bson:"last_synced_at"   json:"lastSyncedAt"`
	LastSyncedBy   string             `bson:"last_synced_by"   json:"lastSyncedBy"` // email
	SyncHash       string             `bson:"sync_hash"        json:"syncHash"`
	CreatedAt      time.Time          `bson:"created_at"       json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updated_at"       json:"updatedAt"`
}

// SyncStats holds counters for a single sync run.
type SyncStats struct {
	Created int `bson:"created" json:"created"`
	Updated int `bson:"updated" json:"updated"`
	Skipped int `bson:"skipped" json:"skipped"`
	Errors  int `bson:"errors"  json:"errors"`
}

// SyncChange records one item changed during a sync.
type SyncChange struct {
	EstimatorID  string `bson:"estimator_id"   json:"estimatorId"`
	JiraKey      string             `bson:"jira_key"       json:"jiraKey"`
	Action       string             `bson:"action"         json:"action"` // "created" | "updated" | "skipped" | "error"
	Reason       string             `bson:"reason"         json:"reason"`
	ErrorMessage string             `bson:"error_message"  json:"errorMessage"`
}

// JiraSyncHistory is stored in the "jira_sync_history" collection.
// SyncType is "import" or "export".
// Direction is "jira_to_estimator" or "estimator_to_jira".
type JiraSyncHistory struct {
	ID          primitive.ObjectID `bson:"_id"           json:"id"`
	ProjectID   primitive.ObjectID `bson:"project_id"    json:"projectId"`
	SyncType    string             `bson:"sync_type"     json:"syncType"`    // "import" | "export"
	Direction   string             `bson:"direction"     json:"direction"`   // "jira_to_estimator" | "estimator_to_jira"
	TriggeredBy string             `bson:"triggered_by"  json:"triggeredBy"` // email
	TriggeredAt time.Time          `bson:"triggered_at"  json:"triggeredAt"`
	CompletedAt time.Time          `bson:"completed_at"  json:"completedAt"`
	Stats       SyncStats          `bson:"stats"         json:"stats"`
	Changes     []SyncChange       `bson:"changes"       json:"changes"`
	Notes       string             `bson:"notes"         json:"notes"`
}

// ---------------------------------------------------------------------------
// Adapter return types
// ---------------------------------------------------------------------------

// ImportResult describes the outcome of importing a single Jira issue.
type ImportResult struct {
	EstimatorID  string `json:"estimatorId"`
	JiraKey      string             `json:"jiraKey"`
	Status       string             `json:"status"`       // "created" | "updated" | "skipped" | "error"
	Reason       string             `json:"reason"`
	ErrorMessage string             `json:"errorMessage"`
}

// ExportResult describes the outcome of exporting a single estimator item.
type ExportResult struct {
	EstimatorID  string `json:"estimatorId"`
	JiraKey      string             `json:"jiraKey"`
	Status       string             `json:"status"`       // "created" | "updated" | "skipped" | "error"
	Reason       string             `json:"reason"`
	ErrorMessage string             `json:"errorMessage"`
}

// ProjectImportResult summarises a full project import run.
type ProjectImportResult struct {
	EpicsImported int           `json:"epicsImported"`
	StoriesCreated int          `json:"storiesCreated"`
	MappingsAdded int           `json:"mappingsAdded"`
	Errors        []string      `json:"errors"`
	Duration      time.Duration `json:"durationMs"`
}

// SyncState is the current sync status for a project.
type SyncState struct {
	ProjectID        primitive.ObjectID `json:"projectId"`
	IsConnected      bool               `json:"isConnected"`
	LastSyncedAt     time.Time          `json:"lastSyncedAt"`
	LastSyncedBy     string             `json:"lastSyncedBy"`
	PendingConflicts int                `json:"pendingConflicts"`
}

// EstimateExport carries estimate data for a feature ready to push to Jira.
type EstimateExport struct {
	EstimatorID string `json:"estimatorId"`
	TShirtSize  string             `json:"tShirtSize"`
	Cost        float64            `json:"cost"`
	Disciplines map[string]float64 `json:"disciplines"`
}

// ---------------------------------------------------------------------------
// Jira Cloud REST API v3 response types
// ---------------------------------------------------------------------------

// JiraIssue represents a single issue returned by the Jira API.
type JiraIssue struct {
	ID     string           `json:"id"`
	Key    string           `json:"key"`
	Fields JiraIssueFields  `json:"fields"`
}

// JiraIssueFields holds the fields of a Jira issue.
type JiraIssueFields struct {
	Summary    string          `json:"summary"`
	IssueType  JiraIssueType   `json:"issuetype"`
	Status     JiraStatus      `json:"status"`
	Assignee   *JiraUser       `json:"assignee"`
	StoryPoints *float64       `json:"customfield_10016"` // story points
	Labels     []string        `json:"labels"`
	DueDate    string          `json:"duedate"`
	Updated    string          `json:"updated"`
	Parent     *JiraParent     `json:"parent"`
	Description interface{}    `json:"description"` // Atlassian Document Format
}

// JiraIssueType represents the type of a Jira issue.
type JiraIssueType struct {
	Name string `json:"name"`
}

// JiraStatus represents the status of a Jira issue.
type JiraStatus struct {
	Name string `json:"name"`
}

// JiraUser represents a Jira user.
type JiraUser struct {
	AccountID    string `json:"accountId"`
	EmailAddress string `json:"emailAddress"`
	DisplayName  string `json:"displayName"`
}

// JiraParent represents the parent issue of a Jira story.
type JiraParent struct {
	ID  string `json:"id"`
	Key string `json:"key"`
}

// JiraSearchResult is the response from the Jira search endpoint.
type JiraSearchResult struct {
	StartAt    int         `json:"startAt"`
	MaxResults int         `json:"maxResults"`
	Total      int         `json:"total"`
	Issues     []JiraIssue `json:"issues"`
}

// JiraResource represents a Jira Cloud instance from the accessible-resources endpoint.
type JiraResource struct {
	ID   string `json:"id"`
	URL  string `json:"url"`
	Name string `json:"name"`
}

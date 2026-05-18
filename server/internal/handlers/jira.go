package handlers

import (
	"encoding/hex"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/soulassembly/estimator/internal/integrations/jira"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const jiraOAuthStateKey = "jira_oauth_state"

// RegisterJiraRoutes wires all Jira integration routes under /api/projects/:id/jira/...
// It instantiates the jira.Service from environment variables:
//   - JIRA_OAUTH_CLIENT_ID
//   - JIRA_OAUTH_CLIENT_SECRET
//   - JIRA_OAUTH_REDIRECT_URI
//   - JIRA_TOKEN_ENCRYPTION_KEY  (64 hex chars = 32 bytes)
// RegisterJiraTopLevelRoutes registers the OAuth callback on a fixed path outside
// the /projects/:id/ group so a single redirect URI can be registered with Atlassian.
// Call this on the root router group (no auth middleware — Atlassian redirects here).
func RegisterJiraTopLevelRoutes(r *gin.Engine, db *mongo.Database) {
	cfg := jira.OAuthConfig{
		ClientID:     os.Getenv("JIRA_OAUTH_CLIENT_ID"),
		ClientSecret: os.Getenv("JIRA_OAUTH_CLIENT_SECRET"),
		RedirectURI:  os.Getenv("JIRA_OAUTH_REDIRECT_URI"),
	}
	encKeyHex := os.Getenv("JIRA_TOKEN_ENCRYPTION_KEY")
	encKey, err := hex.DecodeString(encKeyHex)
	if err != nil || len(encKey) != 32 {
		encKey = make([]byte, 32)
	}
	svc := jira.NewService(db, cfg, encKey)
	h := &jiraHandler{svc: svc, db: db}
	r.GET("/api/jira/oauth/callback", h.oauthCallback)
}

func RegisterJiraRoutes(rg *gin.RouterGroup, db *mongo.Database) {
	cfg := jira.OAuthConfig{
		ClientID:     os.Getenv("JIRA_OAUTH_CLIENT_ID"),
		ClientSecret: os.Getenv("JIRA_OAUTH_CLIENT_SECRET"),
		RedirectURI:  os.Getenv("JIRA_OAUTH_REDIRECT_URI"),
	}

	encKeyHex := os.Getenv("JIRA_TOKEN_ENCRYPTION_KEY")
	encKey, err := hex.DecodeString(encKeyHex)
	if err != nil || len(encKey) != 32 {
		encKey = make([]byte, 32)
	}

	svc := jira.NewService(db, cfg, encKey)
	h := &jiraHandler{svc: svc, db: db}

	project := rg.Group("/projects/:id/jira")
	{
		project.GET("/oauth/start", h.oauthStart)
		project.DELETE("/disconnect", h.disconnect)

		project.POST("/import/project", h.importProject)
		project.POST("/import/epics", h.importEpics)
		project.POST("/import/stories", h.importStories)

		project.POST("/export/estimates", h.exportEstimates)
		project.POST("/export/feature/:featureId", h.exportFeature)
		project.POST("/export/task/:taskId", h.exportTask)

		project.GET("/sync/status", h.syncStatus)
		project.GET("/sync/conflicts", h.syncConflicts)
		project.GET("/sync/history", h.syncHistory)
		project.POST("/sync/resolve", h.syncResolve)
		project.POST("/sync/validate", h.syncValidate)

		project.GET("/config", h.getConfig)
		project.PATCH("/config", h.updateConfig)
	}
}

type jiraHandler struct {
	svc *jira.Service
	db  *mongo.Database
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func projectIDFromParam(c *gin.Context) (primitive.ObjectID, bool) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return primitive.ObjectID{}, false
	}
	return id, true
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

func (h *jiraHandler) oauthStart(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	// Generate a CSRF state token using the project ID + a random component.
	state := primitive.NewObjectID().Hex() + "_" + projectID.Hex()
	session := sessions.Default(c)
	session.Set(jiraOAuthStateKey, state)
	if err := session.Save(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save session"})
		return
	}

	authURL, err := h.svc.GetOAuthURL(c.Request.Context(), projectID, state)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"auth_url": authURL,
		"state":    state,
	})
}

func (h *jiraHandler) oauthCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" || state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code or state"})
		return
	}

	// Validate CSRF state.
	session := sessions.Default(c)
	savedState, _ := session.Get(jiraOAuthStateKey).(string)
	if savedState == "" || savedState != state {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid state parameter"})
		return
	}
	session.Delete(jiraOAuthStateKey)
	session.Save() //nolint:errcheck

	// Extract project ID from the state suffix (<random>_<projectIDHex>).
	parts := strings.SplitN(state, "_", 2)
	if len(parts) != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "malformed state"})
		return
	}
	projectID, err := primitive.ObjectIDFromHex(parts[1])
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id in state"})
		return
	}

	jiraProjectKey := c.Query("jira_project_key") // optional; can be set later via PATCH /config
	userEmail := c.GetString("userEmail")

	if err := h.svc.ExchangeOAuthCode(c.Request.Context(), projectID, userEmail, code, jiraProjectKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	c.Redirect(http.StatusFound, frontendURL+"/projects/"+projectID.Hex()+"?jira=connected")
}

func (h *jiraHandler) disconnect(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	col := h.db.Collection("jira_integrations")
	_, err := col.UpdateOne(
		c.Request.Context(),
		bson.M{"project_id": projectID},
		bson.M{"$set": bson.M{"is_active": false}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

func (h *jiraHandler) importProject(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	var body struct {
		JiraProjectKey string `json:"jira_project_key" binding:"required"`
		Notes          string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.ImportProject(c.Request.Context(), projectID, body.JiraProjectKey, c.GetString("userEmail"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *jiraHandler) importEpics(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	var body struct {
		JiraProjectKey string `json:"jira_project_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results, err := h.svc.ImportEpics(c.Request.Context(), projectID, body.JiraProjectKey, c.GetString("userEmail"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, results)
}

func (h *jiraHandler) importStories(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	var body struct {
		EpicKey string `json:"epic_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results, err := h.svc.ImportStories(c.Request.Context(), projectID, body.EpicKey, c.GetString("userEmail"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, results)
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

func (h *jiraHandler) exportEstimates(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	var body struct {
		FeatureIDs []string `json:"feature_ids"`
		Notes      string   `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var featureIDs []primitive.ObjectID
	for _, s := range body.FeatureIDs {
		oid, err := primitive.ObjectIDFromHex(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feature_id: " + s})
			return
		}
		featureIDs = append(featureIDs, oid)
	}

	results, err := h.svc.ExportEstimates(c.Request.Context(), projectID, featureIDs, body.Notes, c.GetString("userEmail"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, results)
}

func (h *jiraHandler) exportFeature(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	featureID, err := primitive.ObjectIDFromHex(c.Param("featureId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feature id"})
		return
	}

	result, err := h.svc.ExportFeature(c.Request.Context(), projectID, featureID, c.GetString("userEmail"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *jiraHandler) exportTask(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	taskID, err := primitive.ObjectIDFromHex(c.Param("taskId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	result, err := h.svc.ExportTask(c.Request.Context(), projectID, taskID, c.GetString("userEmail"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

func (h *jiraHandler) syncStatus(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	state, err := h.svc.GetSyncState(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, state)
}

func (h *jiraHandler) syncConflicts(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	col := h.db.Collection("jira_mappings")
	cur, err := col.Find(c.Request.Context(), bson.M{"project_id": projectID, "conflict": true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var mappings []jira.JiraMapping
	if err := cur.All(c.Request.Context(), &mappings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if mappings == nil {
		mappings = []jira.JiraMapping{}
	}
	c.JSON(http.StatusOK, mappings)
}

func (h *jiraHandler) syncHistory(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	col := h.db.Collection("jira_sync_history")
	opts := options.Find().
		SetSort(bson.D{{Key: "triggered_at", Value: -1}}).
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cur, err := col.Find(c.Request.Context(), bson.M{"project_id": projectID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var records []jira.JiraSyncHistory
	if err := cur.All(c.Request.Context(), &records); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if records == nil {
		records = []jira.JiraSyncHistory{}
	}
	c.JSON(http.StatusOK, records)
}

func (h *jiraHandler) syncResolve(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	var body struct {
		MappingID string `json:"mapping_id" binding:"required"`
		Winner    string `json:"winner" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mappingID, err := primitive.ObjectIDFromHex(body.MappingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid mapping_id"})
		return
	}

	if err := h.svc.ResolveSyncConflict(c.Request.Context(), projectID, mappingID, body.Winner, c.GetString("userEmail")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *jiraHandler) syncValidate(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	valid, err := h.svc.ValidateConnection(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"valid": valid})
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// safeIntegration is a redacted view of JiraIntegration safe to expose over the API.
type safeIntegration struct {
	ID              primitive.ObjectID `json:"id"`
	ProjectID       primitive.ObjectID `json:"projectId"`
	UserID          string             `json:"userId"`
	JiraInstanceURL string             `json:"jiraInstanceUrl"`
	JiraProjectKey  string             `json:"jiraProjectKey"`
	IsActive        bool               `json:"isActive"`
	TokenExpiresAt  interface{}        `json:"tokenExpiresAt"`
	LastUsedAt      interface{}        `json:"lastUsedAt"`
	Scope           []string           `json:"scope"`
}

func (h *jiraHandler) getConfig(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	col := h.db.Collection("jira_integrations")
	var intg jira.JiraIntegration
	if err := col.FindOne(c.Request.Context(), bson.M{"project_id": projectID}).Decode(&intg); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "no Jira integration configured"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, safeIntegration{
		ID:              intg.ID,
		ProjectID:       intg.ProjectID,
		UserID:          intg.UserID,
		JiraInstanceURL: intg.JiraInstanceURL,
		JiraProjectKey:  intg.JiraProjectKey,
		IsActive:        intg.IsActive,
		TokenExpiresAt:  intg.TokenExpiresAt,
		LastUsedAt:      intg.LastUsedAt,
		Scope:           intg.Scope,
	})
}

func (h *jiraHandler) updateConfig(c *gin.Context) {
	projectID, ok := projectIDFromParam(c)
	if !ok {
		return
	}

	var body struct {
		JiraProjectKey string `json:"jira_project_key"`
		SyncDirection  string `json:"sync_direction"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := bson.M{}
	if body.JiraProjectKey != "" {
		updates["jira_project_key"] = body.JiraProjectKey
	}
	if body.SyncDirection != "" {
		updates["sync_direction"] = body.SyncDirection
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	col := h.db.Collection("jira_integrations")
	res, err := col.UpdateOne(
		c.Request.Context(),
		bson.M{"project_id": projectID},
		bson.M{"$set": updates},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no Jira integration found for this project"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

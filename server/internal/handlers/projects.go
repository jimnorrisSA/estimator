package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/soulassembly/estimator/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func RegisterProjectRoutes(rg *gin.RouterGroup, db *mongo.Database) {
	col := db.Collection("projects")
	h := &projectHandler{col: col}

	rg.GET("/projects", h.list)
	rg.POST("/projects", h.create)
	rg.GET("/projects/:id", h.get)
	rg.PUT("/projects/:id", h.update)
	rg.DELETE("/projects/:id", h.delete)
}

type projectHandler struct {
	col *mongo.Collection
}

func (h *projectHandler) list(c *gin.Context) {
	email := c.GetString("userEmail")
	cur, err := h.col.Find(c.Request.Context(), bson.M{"owner": email})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var projects []models.Project
	if err := cur.All(c.Request.Context(), &projects); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, projects)
}

func (h *projectHandler) create(c *gin.Context) {
	var body struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now().UTC()
	p := models.Project{
		ID:             primitive.NewObjectID(),
		Name:           body.Name,
		Owner:          c.GetString("userEmail"),
		ContingencyPct: 15,
		CalendarMode:   models.CalendarFourWeek,
		Features:       []models.Feature{},
		Resources:      []models.Resource{},
		Milestones:     []models.Milestone{},
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if _, err := h.col.InsertOne(c.Request.Context(), p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *projectHandler) get(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var p models.Project
	if err := h.col.FindOne(c.Request.Context(), bson.M{
		"_id":   id,
		"owner": c.GetString("userEmail"),
	}).Decode(&p); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *projectHandler) update(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var body bson.M
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	body["updated_at"] = time.Now().UTC()
	delete(body, "_id")

	res := h.col.FindOneAndUpdate(
		c.Request.Context(),
		bson.M{"_id": id, "owner": c.GetString("userEmail")},
		bson.M{"$set": body},
	)
	if res.Err() != nil {
		if res.Err() == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": res.Err().Error()})
		return
	}

	var updated models.Project
	res.Decode(&updated) //nolint:errcheck
	c.JSON(http.StatusOK, updated)
}

func (h *projectHandler) delete(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	h.col.DeleteOne(c.Request.Context(), bson.M{ //nolint:errcheck
		"_id":   id,
		"owner": c.GetString("userEmail"),
	})
	c.Status(http.StatusNoContent)
}

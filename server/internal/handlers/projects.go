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
	rg.GET("/projects/shared", h.listShared)
	rg.POST("/projects", h.create)
	rg.GET("/projects/:id", h.get)
	rg.PUT("/projects/:id", h.update)
	rg.DELETE("/projects/:id", h.delete)
	rg.POST("/projects/:id/checkout", h.checkout)
	rg.POST("/projects/:id/checkin", h.checkin)
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

// listShared returns all published projects from any owner.
func (h *projectHandler) listShared(c *gin.Context) {
	email := c.GetString("userEmail")
	// Return published projects not owned by the requester
	cur, err := h.col.Find(c.Request.Context(), bson.M{
		"published": true,
		"owner":     bson.M{"$ne": email},
	})
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

	email := c.GetString("userEmail")
	var p models.Project
	if err := h.col.FindOne(c.Request.Context(), bson.M{
		"_id": id,
		"$or": bson.A{
			bson.M{"owner": email},
			bson.M{"published": true},
		},
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

	email := c.GetString("userEmail")
	var body bson.M
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	body["updated_at"] = time.Now().UTC()
	delete(body, "_id")
	delete(body, "owner")

	// Allow save if owner OR current checkout holder
	res := h.col.FindOneAndUpdate(
		c.Request.Context(),
		bson.M{
			"_id": id,
			"$or": bson.A{
				bson.M{"owner": email},
				bson.M{"checked_out_by": email},
			},
		},
		bson.M{"$set": body},
	)
	if res.Err() != nil {
		if res.Err() == mongo.ErrNoDocuments {
			c.JSON(http.StatusForbidden, gin.H{"error": "not authorised — project may be checked out by someone else"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": res.Err().Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
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

// checkout atomically claims the edit lock for a published project.
func (h *projectHandler) checkout(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	email := c.GetString("userEmail")
	now := time.Now().UTC()

	res, err := h.col.UpdateOne(
		c.Request.Context(),
		bson.M{
			"_id":       id,
			"published": true,
			"$or": bson.A{
				bson.M{"checked_out_by": ""},
				bson.M{"checked_out_by": bson.M{"$exists": false}},
				bson.M{"checked_out_by": email}, // already mine
			},
		},
		bson.M{"$set": bson.M{
			"checked_out_by": email,
			"checked_out_at": now,
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "project is checked out by someone else"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// checkin releases the edit lock. Owner can always release; others only if they hold it.
func (h *projectHandler) checkin(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	email := c.GetString("userEmail")
	_, err = h.col.UpdateOne(
		c.Request.Context(),
		bson.M{
			"_id": id,
			"$or": bson.A{
				bson.M{"owner": email},
				bson.M{"checked_out_by": email},
			},
		},
		bson.M{"$set": bson.M{
			"checked_out_by": "",
			"checked_out_at": nil,
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/soulassembly/estimator/internal/auth"
	"github.com/soulassembly/estimator/internal/db"
	"github.com/soulassembly/estimator/internal/handlers"
	"github.com/soulassembly/estimator/internal/middleware"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	client, err := db.Connect(ctx, mongoURI)
	if err != nil {
		log.Fatalf("failed to connect to MongoDB: %v", err)
	}
	defer client.Disconnect(context.Background()) //nolint:errcheck

	database := client.Database("estimator")

	r := gin.Default()

	store := cookie.NewStore([]byte(os.Getenv("SESSION_SECRET")))
	r.Use(sessions.Sessions("estimator_session", store))

	auth.RegisterRoutes(r, database)

	api := r.Group("/api", middleware.RequireAuth())
	handlers.RegisterProjectRoutes(api, database)

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	log.Printf("API server listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

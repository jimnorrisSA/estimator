package main

import (
	"bufio"
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/soulassembly/estimator/internal/auth"
	"github.com/soulassembly/estimator/internal/db"
	"github.com/soulassembly/estimator/internal/handlers"
	"github.com/soulassembly/estimator/internal/middleware"
)

// loadEnv reads a .env file and sets any unset environment variables from it.
func loadEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return // no .env file is fine
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

func main() {
	loadEnv(".env")
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

	// CORS — only allow the configured frontend origin
	frontendOrigin := os.Getenv("FRONTEND_URL")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:3000"
	}
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == frontendOrigin {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Cross-origin cookies require SameSite=None + Secure in production
	secureCookies := os.Getenv("SESSION_SECURE") == "true"
	sameSite := http.SameSiteLaxMode
	if secureCookies {
		sameSite = http.SameSiteNoneMode
	}
	store := cookie.NewStore([]byte(os.Getenv("SESSION_SECRET")))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 7,
		HttpOnly: true,
		Secure:   secureCookies,
		SameSite: sameSite,
	})
	r.Use(sessions.Sessions("vigo_session", store))

	auth.RegisterRoutes(r, database)

	// Fixed-path Jira OAuth callback — must be outside auth middleware so Atlassian can reach it.
	handlers.RegisterJiraTopLevelRoutes(r, database)

	api := r.Group("/api", middleware.RequireAuth())
	handlers.RegisterProjectRoutes(api, database)
	handlers.RegisterJiraRoutes(api, database)

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	log.Printf("API server listening on :%s (build includes listShared, checkout, checkin)", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

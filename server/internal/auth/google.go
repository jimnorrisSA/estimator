package auth

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const allowedDomain = "soulassembly.com"

var oauthConfig *oauth2.Config

func oauthCfg() *oauth2.Config {
	if oauthConfig != nil {
		return oauthConfig
	}
	oauthConfig = &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
		Scopes:       []string{"openid", "profile", "email"},
		Endpoint:     google.Endpoint,
	}
	return oauthConfig
}

func RegisterRoutes(r *gin.Engine, _ *mongo.Database) {
	r.GET("/api/auth/config", authConfig)
	r.GET("/api/auth/me", me)
	r.POST("/api/auth/logout", logout)

	if os.Getenv("GOOGLE_CLIENT_ID") == "" {
		r.POST("/api/auth/dev-login", devLogin)
	} else {
		r.GET("/api/auth/google", startOAuth)
		r.GET("/api/auth/google/callback", oauthCallback)
	}
}

func startOAuth(c *gin.Context) {
	url := oauthCfg().AuthCodeURL("state", oauth2.AccessTypeOnline)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func oauthCallback(c *gin.Context) {
	code := c.Query("code")
	token, err := oauthCfg().Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "oauth exchange failed"})
		return
	}

	userInfo, err := fetchUserInfo(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user info"})
		return
	}

	email, _ := userInfo["email"].(string)
	if !strings.HasSuffix(email, "@"+allowedDomain) {
		c.JSON(http.StatusForbidden, gin.H{"error": "domain not allowed"})
		return
	}

	sess := sessions.Default(c)
	sess.Set("email", email)
	sess.Set("name", userInfo["name"])
	sess.Save() //nolint:errcheck

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	c.Redirect(http.StatusTemporaryRedirect, frontendURL)
}

func me(c *gin.Context) {
	sess := sessions.Default(c)
	email := sess.Get("email")
	if email == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"email": email, "name": sess.Get("name")})
}

func logout(c *gin.Context) {
	sess := sessions.Default(c)
	sess.Clear()
	sess.Save() //nolint:errcheck
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func authConfig(c *gin.Context) {
	devAvailable := os.Getenv("GOOGLE_CLIENT_ID") == ""
	c.JSON(http.StatusOK, gin.H{
		"devLoginAvailable":    devAvailable,
		"googleLoginAvailable": !devAvailable,
	})
}

func devLogin(c *gin.Context) {
	sess := sessions.Default(c)
	sess.Set("email", "jim.norris@soulassembly.com")
	sess.Set("name", "Jim Norris")
	sess.Save() //nolint:errcheck
	c.JSON(http.StatusOK, gin.H{"ok": true, "email": "jim.norris@soulassembly.com", "name": "Jim Norris"})
}

func fetchUserInfo(ctx context.Context, token *oauth2.Token) (map[string]any, error) {
	client := oauthCfg().Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var info map[string]any
	if err := decodeJSON(resp.Body, &info); err != nil {
		return nil, err
	}
	return info, nil
}

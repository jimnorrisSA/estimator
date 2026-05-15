package jira

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	atlassianAuthorizeURL = "https://auth.atlassian.com/authorize"
	atlassianTokenURL     = "https://auth.atlassian.com/oauth/token"
	requiredScopes        = "read:jira-work write:jira-work offline_access"
)

// OAuthConfig holds the Atlassian OAuth 2.0 3LO application credentials.
type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

// GetAuthURL constructs the Atlassian authorization URL.
// state should be a securely generated CSRF token that the caller stores in the session.
func GetAuthURL(cfg OAuthConfig, state string) string {
	params := url.Values{}
	params.Set("audience", "api.atlassian.com")
	params.Set("client_id", cfg.ClientID)
	params.Set("scope", requiredScopes)
	params.Set("redirect_uri", cfg.RedirectURI)
	params.Set("state", state)
	params.Set("response_type", "code")
	params.Set("prompt", "consent")

	return atlassianAuthorizeURL + "?" + params.Encode()
}

// tokenResponse is the JSON body returned by the Atlassian token endpoint.
type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
}

// postToken sends a POST to the Atlassian token endpoint with the given payload.
func postToken(ctx context.Context, payload map[string]string) (*tokenResponse, error) {
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal token request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, atlassianTokenURL, bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	hc := &http.Client{Timeout: 15 * time.Second}
	resp, err := hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("token endpoint error %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var tr tokenResponse
	if err := json.Unmarshal(raw, &tr); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}
	return &tr, nil
}

// ExchangeCode exchanges an authorization code for access and refresh tokens.
// Returns accessToken, refreshToken, and expiresIn (seconds).
func ExchangeCode(ctx context.Context, cfg OAuthConfig, code string) (accessToken, refreshToken string, expiresIn int, err error) {
	tr, err := postToken(ctx, map[string]string{
		"grant_type":    "authorization_code",
		"client_id":     cfg.ClientID,
		"client_secret": cfg.ClientSecret,
		"code":          code,
		"redirect_uri":  cfg.RedirectURI,
	})
	if err != nil {
		return "", "", 0, err
	}
	return tr.AccessToken, tr.RefreshToken, tr.ExpiresIn, nil
}

// RefreshAccessToken uses a refresh token to obtain a new access token.
// Returns the new accessToken and expiresIn (seconds).
func RefreshAccessToken(ctx context.Context, cfg OAuthConfig, refreshToken string) (accessToken string, expiresIn int, err error) {
	tr, err := postToken(ctx, map[string]string{
		"grant_type":    "refresh_token",
		"client_id":     cfg.ClientID,
		"client_secret": cfg.ClientSecret,
		"refresh_token": refreshToken,
	})
	if err != nil {
		return "", 0, err
	}
	return tr.AccessToken, tr.ExpiresIn, nil
}

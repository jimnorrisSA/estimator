package jira

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	atlassianAPIBase        = "https://api.atlassian.com/ex/jira/%s/rest/api/3"
	accessibleResourcesURL  = "https://api.atlassian.com/oauth/token/accessible-resources"
	defaultMaxResults       = 50
)

// Client is an HTTP client for the Jira Cloud REST API v3.
type Client struct {
	cloudID     string
	accessToken string
	httpClient  *http.Client
}

// NewClient creates a new Jira API client.
func NewClient(cloudID, accessToken string) *Client {
	return &Client{
		cloudID:     cloudID,
		accessToken: accessToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) baseURL() string {
	return fmt.Sprintf(atlassianAPIBase, c.cloudID)
}

// do executes an authenticated HTTP request and decodes the JSON response into dest.
// Pass dest=nil to discard the response body (e.g. for 204 responses).
func (c *Client) do(ctx context.Context, method, url string, body interface{}, dest interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("jira API error %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	if dest == nil || resp.StatusCode == http.StatusNoContent {
		return nil
	}

	if err := json.NewDecoder(resp.Body).Decode(dest); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

// SearchIssues runs a JQL query with automatic pagination and returns all matching issues.
func (c *Client) SearchIssues(ctx context.Context, jql string, fields []string) ([]JiraIssue, error) {
	var all []JiraIssue
	startAt := 0

	for {
		payload := map[string]interface{}{
			"jql":        jql,
			"startAt":    startAt,
			"maxResults": defaultMaxResults,
			"fields":     fields,
		}

		url := c.baseURL() + "/search"
		var result JiraSearchResult
		if err := c.do(ctx, http.MethodPost, url, payload, &result); err != nil {
			return nil, fmt.Errorf("search issues (startAt=%d): %w", startAt, err)
		}

		all = append(all, result.Issues...)

		startAt += len(result.Issues)
		if startAt >= result.Total || len(result.Issues) == 0 {
			break
		}
	}

	return all, nil
}

// GetIssue fetches a single issue by key.
func (c *Client) GetIssue(ctx context.Context, key string) (*JiraIssue, error) {
	url := fmt.Sprintf("%s/issue/%s", c.baseURL(), key)
	var issue JiraIssue
	if err := c.do(ctx, http.MethodGet, url, nil, &issue); err != nil {
		return nil, fmt.Errorf("get issue %s: %w", key, err)
	}
	return &issue, nil
}

// CreateIssue creates a new Jira issue. body is the JSON payload map.
// Returns the newly created issue.
func (c *Client) CreateIssue(ctx context.Context, body map[string]interface{}) (*JiraIssue, error) {
	url := c.baseURL() + "/issue"
	var issue JiraIssue
	if err := c.do(ctx, http.MethodPost, url, body, &issue); err != nil {
		return nil, fmt.Errorf("create issue: %w", err)
	}
	return &issue, nil
}

// UpdateIssue updates the fields of an existing issue.
func (c *Client) UpdateIssue(ctx context.Context, key string, fields map[string]interface{}) error {
	url := fmt.Sprintf("%s/issue/%s", c.baseURL(), key)
	payload := map[string]interface{}{"fields": fields}
	if err := c.do(ctx, http.MethodPut, url, payload, nil); err != nil {
		return fmt.Errorf("update issue %s: %w", key, err)
	}
	return nil
}

// GetAccessibleResources fetches the list of Jira Cloud instances the token has access to.
// This is a package-level function (not a method) because it is called before cloudID is known.
func GetAccessibleResources(ctx context.Context, accessToken string) ([]JiraResource, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, accessibleResourcesURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create accessible-resources request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	hc := &http.Client{Timeout: 15 * time.Second}
	resp, err := hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch accessible resources: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("accessible-resources error %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var resources []JiraResource
	if err := json.NewDecoder(resp.Body).Decode(&resources); err != nil {
		return nil, fmt.Errorf("decode accessible resources: %w", err)
	}
	return resources, nil
}

package jira

import (
	"fmt"
	"strings"
)

// ---------------------------------------------------------------------------
// Story points ↔ T-shirt size
// ---------------------------------------------------------------------------

// StoryPointsToTShirtSize converts a numeric story-point value to a T-shirt size label.
// Boundaries: 0-1→XS, 2-3→S, 5→M, 8→L, 13→XL, 21+→XXL. Anything else defaults to M.
func StoryPointsToTShirtSize(points float64) string {
	switch {
	case points <= 1:
		return "XS"
	case points <= 3:
		return "S"
	case points <= 5:
		return "M"
	case points <= 8:
		return "L"
	case points <= 13:
		return "XL"
	default:
		return "XXL"
	}
}

// TShirtSizeToStoryPoints converts a T-shirt size label to a canonical story-point value.
// XS→1, S→3, M→5, L→8, XL→13, XXL→21. Unknown sizes default to 5.
func TShirtSizeToStoryPoints(size string) float64 {
	switch strings.ToUpper(size) {
	case "XS":
		return 1
	case "S":
		return 3
	case "M":
		return 5
	case "L":
		return 8
	case "XL":
		return 13
	case "XXL":
		return 21
	default:
		return 5
	}
}

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

// JiraIssueToFeatureName returns a clean feature name from a Jira epic.
// Strips leading/trailing whitespace and falls back to the issue key if the summary is empty.
func JiraIssueToFeatureName(issue JiraIssue) string {
	name := strings.TrimSpace(issue.Fields.Summary)
	if name == "" {
		return issue.Key
	}
	return name
}

// JiraIssueToDiscipline infers a discipline string from a Jira issue's labels or issue type.
// Checks labels first (case-insensitive match against known disciplines), then falls back to "Code".
func JiraIssueToDiscipline(issue JiraIssue) string {
	known := map[string]string{
		"art":        "Art",
		"design":     "Design",
		"code":       "Code",
		"dev":        "Code",
		"engineering": "Code",
		"production": "Production",
		"prod":       "Production",
	}

	for _, label := range issue.Fields.Labels {
		lower := strings.ToLower(label)
		if d, ok := known[lower]; ok {
			return d
		}
	}

	// Fall back to issue type heuristics
	typeLower := strings.ToLower(issue.Fields.IssueType.Name)
	switch {
	case strings.Contains(typeLower, "design"):
		return "Design"
	case strings.Contains(typeLower, "art"):
		return "Art"
	default:
		return "Code"
	}
}

// ---------------------------------------------------------------------------
// Jira issue body builders
// ---------------------------------------------------------------------------

// BuildJiraIssueBody creates the JSON payload map for creating or updating a Jira issue.
// issueType should be "Epic" or "Story". projectKey is the Jira project key (e.g. "DANCE").
// storyPoints is stored in customfield_10016.
func BuildJiraIssueBody(projectKey, issueType, summary string, storyPoints float64) map[string]interface{} {
	fields := map[string]interface{}{
		"project": map[string]string{
			"key": projectKey,
		},
		"summary": summary,
		"issuetype": map[string]string{
			"name": issueType,
		},
		"customfield_10016": storyPoints,
	}

	// Epics need a name field in addition to summary on some Jira configurations.
	if strings.EqualFold(issueType, "epic") {
		fields["customfield_10011"] = summary // Epic Name (classic projects)
	}

	return map[string]interface{}{"fields": fields}
}

// BuildEstimateUpdateBody creates the fields map for updating custom estimate fields on a Jira issue.
// This is passed directly to UpdateIssue as the fields parameter.
// tshirtSize is stored as a label. cost and discipline totals are stored in custom text fields.
func BuildEstimateUpdateBody(tshirtSize string, cost float64, disciplines map[string]float64) map[string]interface{} {
	fields := map[string]interface{}{
		"customfield_10016": TShirtSizeToStoryPoints(tshirtSize), // story points
		"labels":            []string{"estimate:" + tshirtSize},
	}

	// Encode cost as a custom text field (customfield_10100 is a common placeholder).
	fields["customfield_10100"] = fmt.Sprintf("%.2f", cost)

	// Encode per-discipline totals as a formatted string in another custom field.
	if len(disciplines) > 0 {
		var parts []string
		for d, v := range disciplines {
			parts = append(parts, fmt.Sprintf("%s:%.1f", d, v))
		}
		fields["customfield_10101"] = strings.Join(parts, ", ")
	}

	return fields
}

// ---------------------------------------------------------------------------
// Atlassian Document Format text extraction
// ---------------------------------------------------------------------------

// ContentToText extracts plain text from an Atlassian Document Format (ADF) description.
// Returns an empty string if the description is nil or cannot be parsed.
func ContentToText(description interface{}) string {
	if description == nil {
		return ""
	}

	doc, ok := description.(map[string]interface{})
	if !ok {
		return ""
	}

	var sb strings.Builder
	extractADFText(doc, &sb)
	return strings.TrimSpace(sb.String())
}

// extractADFText recursively walks an ADF node tree and writes text content to sb.
func extractADFText(node map[string]interface{}, sb *strings.Builder) {
	nodeType, _ := node["type"].(string)

	// Leaf text node — write its text value.
	if nodeType == "text" {
		if text, ok := node["text"].(string); ok {
			sb.WriteString(text)
		}
		return
	}

	// Paragraph and other block nodes — append a newline after processing children.
	children, _ := node["content"].([]interface{})
	for _, child := range children {
		childMap, ok := child.(map[string]interface{})
		if !ok {
			continue
		}
		extractADFText(childMap, sb)
	}

	// Add spacing after block-level nodes.
	switch nodeType {
	case "paragraph", "heading", "listItem", "bulletList", "orderedList":
		sb.WriteString(" ")
	}
}

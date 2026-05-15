# Next Session — Pending Work

## ✅ Completed (last session)

- **Sprints within milestones** — `sprintLengthWeeks?: 2 | 3` on Milestone, sprint selector (None / 2w / 3w) in milestone list, alternating sprint column bands + S1/S2/… dividers in Timeline
- **Monthly rate model** — daily rate replaced with monthly rate throughout; default FTE = £6,700/month
- **Working days / month** — configurable setting (default 22), wired into all cost calculations and SettingsPanel
- **Agency fee (DDM)** — configurable label + percentage (default 10%) in Cost Summary, applied on top of at-cost total
- **Jira backend** — full Phase 1 implementation committed: OAuth 2.0 (Atlassian 3LO), field mapper, importer, exporter, sync state, 14 REST endpoints

---

## 1. Jira — environment setup (do on work PC first)

The backend code is complete and compiles. To activate it:

### Step 1 — Create Atlassian OAuth app
1. Go to https://developer.atlassian.com/console/myapps
2. Create a new **OAuth 2.0 (3LO)** app (not an API token)
3. Set **Redirect URI** to:
   `http://localhost:4000/api/projects/<your_project_id>/jira/oauth/callback`
   _(Use a real project ObjectID from MongoDB, or update this before first auth)_
4. Add scopes: `read:jira-work`, `write:jira-work`, `offline_access`
5. Copy the **Client ID** and **Client Secret**

### Step 2 — Generate encryption key
Run in any terminal:
```bash
openssl rand -hex 32
```
Produces a 64-character hex string for `JIRA_TOKEN_ENCRYPTION_KEY`.

### Step 3 — Fill in `server/.env`
Four blank Jira lines are already there — fill them in:
```
JIRA_OAUTH_CLIENT_ID=<from Atlassian console>
JIRA_OAUTH_CLIENT_SECRET=<from Atlassian console>
JIRA_OAUTH_REDIRECT_URI=http://localhost:4000/api/projects/<project_id>/jira/oauth/callback
JIRA_TOKEN_ENCRYPTION_KEY=<64 hex chars from openssl>
```

### Step 4 — Create Jira custom fields
In your Jira instance, create these before first export:

| Field name | Type |
|---|---|
| `Estimate T-shirt Size` | Select list |
| `Art Estimate` | Number |
| `Code Estimate` | Number |
| `Design Estimate` | Number |
| `Prod Estimate` | Number |
| `Estimate Cost` | Number |

### Files already in place (no code changes needed)
- `server/internal/integrations/jira/` — 9 Go files (models, crypto, client, oauth, mapper, importer, exporter, sync, adapter)
- `server/internal/handlers/jira.go` — 14 API routes
- `server/cmd/api/main.go` — `RegisterJiraRoutes` already wired in

---

## 2. Jira — Phase 2 UI (deferred, do after backend confirmed working)

- "Connect Jira" button in project settings → kicks off OAuth flow
- Import modal: preview epics/stories before confirming
- Export modal: review which features/tasks will be pushed
- Sync status badge (connected / last synced / pending conflicts)
- Conflict resolution UI (choose estimator vs Jira winner per item)

---

## 3. Milestone focus view (Phase 3, deferred)

- Clicking a milestone in MilestonesPage filters the timeline to that milestone's date range
- X-axis resets to the milestone's start day so sprint bands align with task bars
- "Back / All milestones" toggle exits the filtered view

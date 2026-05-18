# Jira Integration — Environment Setup Guide

Follow these steps on your work PC before testing the Jira connection.

---

## Step 1 — Create an Atlassian OAuth 2.0 App

1. Go to [https://developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps)
2. Click **Create** → choose **OAuth 2.0 integration**
3. Give it a name (e.g. `Estimator Dev`)
4. Once created, go to **Authorization** in the left sidebar
5. Add a **Callback URL**:
   ```
   http://localhost:4000/api/projects/{YOUR_PROJECT_ID}/jira/oauth/callback
   ```
   > Replace `{YOUR_PROJECT_ID}` with a real MongoDB ObjectID from your project list.
   > You can get this from the URL bar when you open a project in the Estimator app,
   > or from MongoDB Atlas — it's a 24-character hex string like `664f1a2b3c4d5e6f7a8b9c0d`.

6. Go to **Permissions** in the left sidebar and add these scopes:
   - `read:jira-work`
   - `write:jira-work`
   - `offline_access`

7. Go to **Settings** in the left sidebar and copy:
   - **Client ID**
   - **Client Secret** (click to reveal)

---

## Step 2 — Generate an Encryption Key

Run this in any terminal (Git Bash, PowerShell with OpenSSL, WSL, or your Mac):

```bash
openssl rand -hex 32
```

This outputs a 64-character hex string. Copy it — you'll need it for `JIRA_TOKEN_ENCRYPTION_KEY`.

> **No OpenSSL on Windows?** Use this PowerShell alternative:
> ```powershell
> -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
> ```

---

## Step 3 — Fill In `server/.env`

Open `server/.env` in the Estimator project. Find the four blank Jira lines and fill them in:

```env
JIRA_OAUTH_CLIENT_ID=<paste Client ID from Atlassian console>
JIRA_OAUTH_CLIENT_SECRET=<paste Client Secret from Atlassian console>
JIRA_OAUTH_REDIRECT_URI=http://localhost:4000/api/projects/{YOUR_PROJECT_ID}/jira/oauth/callback
JIRA_TOKEN_ENCRYPTION_KEY=<paste 64-char hex string from Step 2>
```

> The redirect URI must exactly match what you entered in Step 1, including the project ID.

---

## Step 4 — Create Custom Fields in Jira

In your Jira instance (as an admin):

1. Go to **Settings** → **Issues** → **Custom fields**
2. Create each of the following fields:

| Field name              | Type            | Notes                          |
|-------------------------|-----------------|--------------------------------|
| `Estimate T-shirt Size` | Select list     | Options: XS, S, M, L, XL, XXL |
| `Art Estimate`          | Number field    | Days                           |
| `Code Estimate`         | Number field    | Days                           |
| `Design Estimate`       | Number field    | Days                           |
| `Prod Estimate`         | Number field    | Days                           |
| `Estimate Cost`         | Number field    | GBP                            |

3. Add each custom field to the **screens** used by your epics/stories
   (Fields → ... → Screens → tick the relevant screens)

---

## Step 5 — Restart the Go Server

```bash
cd server
go run ./cmd/api
```

Look for this in the output (confirms Jira routes registered):
```
[GIN] POST   /api/projects/:id/jira/oauth/init
[GIN] GET    /api/projects/:id/jira/oauth/callback
```

---

## Step 6 — Test the Connection (from Estimator UI)

Once the UI is built, you'll use a **Connect Jira** button in project settings.  
The OAuth flow will:
1. Redirect you to Atlassian to authorise the app
2. Redirect back to `localhost:4000/...callback`
3. Store the encrypted token in MongoDB

> **First-time auth:** Use the project whose ID you put in the redirect URI.  
> After the first successful connection, you can update the redirect URI to be more generic.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `redirect_uri_mismatch` from Atlassian | URI in `.env` doesn't match exactly what's in Atlassian console |
| `invalid_client` | Wrong Client ID or Secret |
| Token decrypt errors in server logs | `JIRA_TOKEN_ENCRYPTION_KEY` changed after a token was stored — clear the jira token from MongoDB |
| `403` on Jira API calls | Missing scopes — re-authorise after adding `offline_access` |
| Custom fields not appearing on export | Fields not added to the right Jira screens (Step 4, point 3) |

---

## What the Backend Already Supports

Once connected, the Estimator can:

- **Import** Jira epics → Features, stories → Tasks (with T-shirt size + discipline estimates)
- **Export** Features/Tasks → Jira epics/stories (creating or updating)
- **Sync** — two-way, with conflict detection (estimator wins or Jira wins, per item)
- **Disconnect** — revokes token and clears stored credentials

All 14 API endpoints are already live in the Go server. The UI (connect button, modals, sync badge) is being built now.

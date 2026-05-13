# Estimator — Claude Code Guide

## What this project is
A collaborative web tool for estimating project features using T-shirt sizing, then producing scheduling, cost, and timeline outputs. Spec: `Estimation_Cost_Tool_Spec.md`.

## Repository structure
```
packages/client    React SPA (Vite + TypeScript). Port 3000 in dev.
packages/shared    Shared TypeScript types — the authoritative data model.
server/            Go API server. Port 4000 in dev.
docs/phase-1-reference/   Visual reference images for Phase 1 UI.
```

## Key tech choices (from spec §9.1)
- **Canvas (Phase 1):** Konva + react-konva
- **Timelines (Phase 2–4):** SVG
- **Real-time collab:** Yjs + y-websocket (Node.js sidecar alongside Go API)
- **Auth:** Google OAuth, restricted to `@soulassembly.com`
- **Client state:** Zustand (localStorage fallback until server is wired in)
- **Backend:** Go + Gin
- **Data store:** MongoDB (mongo-driver for Go)

## Hosting plan (get team online now, permanent migration later)
Deploy the planned stack on cheap managed services:
- **MongoDB:** MongoDB Atlas free tier (M0, 512MB) — `MONGODB_URI` env var in Go server
- **Go API:** Railway or Fly.io (free/hobby tier) — containerised via Dockerfile
- **Yjs realtime:** y-websocket as a separate Railway service (Node.js, already in client deps)
- **React SPA:** Vercel (free tier, auto-deploy from GitHub)
- **Auth:** Google OAuth handled in the Go server, restricted to `@soulassembly.com`

## Running locally

**Frontend (Phase 1 — no backend needed yet):**
```bash
pnpm install
pnpm --filter @estimator/client dev   # http://localhost:3000
```

**Go server (when ready):**
```bash
cd server
cp .env.example .env   # fill in credentials
go run ./cmd/api
```

## Phases (build order)
1. Estimations — Konva canvas, feature boxes, post-its with estimates ✅
2. Scheduling & Cost Collector — timeline, editable specs table, cost math
3. Roster — resources with roll-on/off dates and rates
4. Timeline Generator + Plantastic integration — milestone line, push/pull sync

## Landing page requirements
- Full-screen hero background image (user-supplied, place at `packages/client/src/assets/hero.jpg`)
- Logo featured prominently (top-center or overlaid)
- Large CTA buttons: **New Project**, **Existing Projects**
- Flashy/bold design — dark overlay on image, large typography
- Unauthenticated users always land here; authenticated users go to project dashboard

## Plantastic integration
Adapter stub at `server/internal/integrations/plantastic/adapter.go`.
Build against the stub until the live API contract is confirmed with the Plantastic team.
Round-trip sync uses `origin` stamps to suppress echo loops (spec §7.4).

## Data model
- **TypeScript (client):** `packages/shared/src/types/project.ts`
- **Go (server):** `server/internal/models/project.go`
Both mirror the same spec data model. Keep them in sync when the schema changes.
One source of truth per task — Phase 1 canvas, Phase 2 grid, and Phase 4 timeline are views of the same records.

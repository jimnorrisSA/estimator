# Estimator — Claude Code Guide

## What this project is
A collaborative web tool for estimating project features using T-shirt sizing, then producing scheduling, cost, and timeline outputs. Spec: `Estimation_Cost_Tool_Spec.md`.

## Monorepo structure
```
packages/client    React SPA (Vite + TypeScript). Port 3000 in dev.
packages/server    Node.js API + WebSocket server. Port 4000 in dev.
packages/shared    Shared TypeScript types — the authoritative data model.
docs/phase-1-reference/   Visual reference images for Phase 1 UI (add before build kickoff).
```

## Key tech choices (from spec)
- **Canvas (Phase 1):** Konva + react-konva
- **Timelines (Phase 2–4):** SVG
- **Real-time collab:** Yjs with y-websocket; presence on a separate ephemeral channel
- **Auth:** Google OAuth, restricted to `@soulassembly.com`
- **State:** Zustand on the client

## Running locally
```bash
pnpm install
pnpm dev          # starts client (3000) and server (4000) in parallel
```
Copy `.env.example` to `.env` in `packages/server` and fill in credentials.

## Phases (build order)
1. Estimations — Konva canvas, feature boxes, post-its with estimates
2. Scheduling & Cost Collector — timeline, editable specs table, cost math
3. Roster — resources with roll-on/off dates and rates
4. Timeline Generator + Plantastic integration — milestone line, push/pull sync

## Plantastic integration
Adapter lives at `packages/server/src/integrations/plantastic/adapter.ts`.
Build against the stub until the live API contract is confirmed with the Plantastic team.
Round-trip sync uses `origin` stamps to suppress echo loops.

## Data model
Canonical types in `packages/shared/src/types/project.ts`.
One source of truth per task — Phase 1 canvas, Phase 2 grid, and Phase 4 timeline are views of the same records.

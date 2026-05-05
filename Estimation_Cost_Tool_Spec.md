# Project Estimation and Cost Tool — Engineering Specification

**Version:** 0.3 (draft)
**Author:** Jim Norris (Soul Assembly)
**Date:** May 5, 2026
**Audience:** Engineering team (build document)
**Source:** Jim's notes, with structural detail informed by the JIRA reverse spec.

**Changelog**
- *0.3* — Mobile support deferred to v2; Production added as 4th discipline (matches Plantastic); CRDT history retention strategy specified; estimate edits now round-trip from Plantastic.
- *0.2* — Resolved 9 of 10 open questions with Jim's answers.
- *0.1* — Initial draft from notes.

> Notes from Jim are reproduced as-is and grouped under their natural section. Anything not explicitly stated in the notes is flagged as **[implied]**. Items previously flagged **[open]** are now resolved inline with answers from Jim.

---

## 1. Purpose

The tool enables multiple team members to estimate features using T-shirt-sizing techniques. Estimates are organized into a timeline and exported for use in living documents or pitches for future partners.

The program comes together in a number of parts and ends with the output of accurate **budget**, **scheduling**, and **timeline** information that is visualized in a number of different ways.

---

## 2. Phases

| Phase | Title |
|-------|-------|
| 1 | Estimations |
| 2 | Scheduling and Cost Collector |
| 3 | Roster |
| 4 | Timeline Generator + Plantastic integration |

Phases are sequential build milestones; they are also functional layers of the product. A user moves through them in order on a single project.

---

## 3. Cross-Cutting Requirements

These apply to all four phases.

### 3.1 Platform

- **Web-based.**
- Must support **multiple sessions over multiple days** — work persists across closing the browser and reopening.
- Must support **save and load on different PCs** — a user starts on PC A, finishes on PC B.

### 3.2 Multi-user (real-time)

- **Multiple users** must be able to use the tool **at the same time**.
- **Real-time co-editing.** Multiple users see each other's changes live (Miro / Figma model), including presence (cursors / selections) on the canvas.
- **Implementation note.** The standard pattern is a CRDT layer — **Yjs** (well-supported, integrates with Konva/Fabric/SVG canvases) or **Automerge**. Both give per-element conflict-free merging and offline tolerance. Decide between Yjs and Automerge during the architecture spike; default recommendation is Yjs.
- **Presence channel.** Cursor positions, selections, and "user X is here" badges ride on a separate ephemeral channel (websocket broadcasts, no persistence).
- **Soft-locks** are unnecessary with CRDTs but the UI should still show "edited 2s ago by Sarah" hover tooltips on recently-touched elements.

### 3.3 Authentication

- Login using **the company's Google accounts** (Google OAuth, restricted to the Soul Assembly workspace domain).
- **External collaborators do not view data in-app.** Pitches are shared as exported documents (PDF / Word) — see Phase 2 outputs. There is no public share-link view of the live project.
- This simplifies the permission model considerably: only authenticated Soul Assembly users have any in-app access.

### 3.4 Persistence

- **Final-state architecture: server-backed datastore.** A backend service owns project data; clients connect over websocket for real-time sync; document exports are generated server-side.
- **Early-testing fallback.** Until the server is built, projects can be persisted via **Google Drive** (one Drive doc per project, owned by the creator) or **browser local storage** (single-PC, no multi-user). Both are stop-gaps and will be migrated off of when the server lands.
- **Migration path.** Schema is the same in all three modes; the storage adapter is swappable. A "save to Drive" export remains useful even after the server is in place, as a backup / hand-off mechanism.

### 3.5 UI customization (universal)

- **All post-its, boxes, shapes, and text are resizable.**
- **All colors are customizable.**
- **[implied]** "Customizable" means per-user theme overrides as well as per-element ad-hoc color picks. Defaults are needed (Phase 1 ships with the Art / Design / Code colors below).

### 3.6 Out-of-scope (this version)

- **Dependencies** between tasks — Jim's notes say "Adding in dependencies should be explored later." Not in scope for v1.
- Workflow customization, custom fields beyond what Phase 1–4 require, audit log, granular permission schemes.

---

## 4. Phase 1 — Estimations

### 4.1 Goal

The team takes a list of features (or work required for the project) and quickly adds post-it notes that can be labelled to represent the amount of work needed for a feature and its individual parts.

The team has historically done this in Miro because of its great built-in labellable post-it system. This tool replaces that part of the Miro workflow with a structured equivalent that feeds directly into Phases 2–4.

### 4.2 Workflow

1. **Define features as a list.** The user inputs a list of feature names into the **Estimation List** input. Each line becomes a feature.
2. **Generate boxes.** Each feature in the list is rendered as a box on the canvas.
3. **Pre-populate post-its.** Every generated box comes with a few default post-it notes in **four colors**, one per discipline:
   - **Art** (color A)
   - **Design** (color B)
   - **Code** (color C)
   - **Production** (color D)

   The four disciplines match Plantastic's discipline taxonomy so the mapping in Phase 4 is one-to-one.
4. **Label tasks.** The team adds specific tasks for the feature by writing labels on the post-its.
5. **Add an estimate** to each task. Estimate units: **half-days, days, weeks, or months.**
6. **Render the estimate inline.** The estimate is shown **below the work label in smaller text**, and **enlarges on mouse-over**.

### 4.3 Element behavior

| Element | Behavior |
|---------|----------|
| Feature box | Container for post-its; resizable; named (mirrors the feature list entry). |
| Post-it | Labellable; resizable; recolorable; carries one estimate. Default colors per discipline (Art/Design/Code/Production). |
| Task label | Free text on a post-it. The "work label." |
| Estimate label | Smaller text below the task label. Mouse-over enlarges it for readability. |
| Canvas | Pan/zoom; multiple feature boxes per canvas. **[implied]** since this replaces a Miro workflow. |

### 4.4 Estimation entry — free-form duration

- The estimate field on a post-it is **free-form**. The user enters whatever duration value makes sense for the task.
- Suggested input formats: a number plus a unit picker (e.g., `2.5` + `days`), or a parsed string (`2.5d`, `1w 3d`, `0.5 month`). The picker is the simpler implementation; the parsed string is closer to JIRA's input pattern. **[implied]** Recommendation: number + unit picker for v1.
- **Unit conversions** (used internally to resolve to working days for downstream scheduling):

| Unit | Working days |
|------|--------------|
| half-day | 0.5 |
| day | 1 |
| week | 5 |
| month | 20 (consistent with Phase 2's "four-week month" mode) |

- Display preserves what the user typed. The resolved working-day value is used by the scheduler and cost collector but is not the displayed value on the post-it.

### 4.5 T-shirt sizing terminology

T-shirt sizing is the **conversational technique** the team uses when discussing how big a task feels — it is *not* a stored enum on the data model. The recorded value on every post-it is a duration (per 4.4). No XS/S/M/L/XL field exists.

### 4.6 Data model (Phase 1)

```
Project
  id, name, owner, created_at, updated_at
  -> features: Feature[]

Feature
  id, project_id, name, position (canvas x,y), width, height, color
  -> postits: PostIt[]

PostIt
  id, feature_id, discipline (Art | Design | Code | Production | Custom),
  color, position, width, height,
  task_label (text),
  estimate { value: number, unit: half_day | day | week | month }
  -> resolved_working_days (computed)
```

### 4.7 UI deferred-but-implied

- **Adding / removing / re-ordering** post-its inside a feature box.
- **Dragging post-its** between feature boxes (re-parenting).
- **Editing** the feature list after the boxes have been generated (renames propagate; deletes prompt).
- **Undo / redo** at the canvas level.

### 4.8 Visual reference

Jim's notes include a "Visual example of Features and tasks estimates" — capture this as a reference image and store it under `/docs/phase-1-reference/` before build kickoff.

---

## 5. Phase 2 — Scheduling and Cost Collector

### 5.1 Goal

Take the estimates from Phase 1 and populate them on an **easy-to-read timeline.**

### 5.2 Calendar modes

The timeline is configurable to one of two display modes:

- **Actual calendar days** — Mon–Fri working days against a real calendar.
- **Four-week months** — abstract, idealized 4-week (20 working day) months. Used for early pitch-stage estimates where calendar dates are not yet meaningful.

Switching modes recomputes the timeline view; the underlying data is the same (working days).

### 5.3 Contingency

- A **figure for contingency** is settable **per project**. It is a **percentage of time held back** for:
  - sickness,
  - unforeseen circumstances,
  - potentially un-estimated or improperly estimated work.
- Contingency is applied **at the project level**, not per-task or per-feature.
- It renders on the timeline as a single trailing block at the end of the project (visually obvious to anyone reading a pitch), and as an additive line item in the cost collector.
- The default is configurable per project; suggested default is `15%`.

### 5.4 Output formats

The scheduling timeliner outputs in **several formats**. It must be viewable at a **very detailed level, like that of JIRA** or traditional production strategies.

External collaborators receive the project as **document exports** (per 3.3); they do not access the live in-app data.

| Output | Purpose | Notes |
|--------|---------|-------|
| Detailed view (in-app) | Day-level grid showing every task | Editable inline (see 5.5); Soul Assembly users only |
| Summary view (in-app) | Feature-level bars on the timeline | For pitch preview before export |
| Export: PDF | Pitch / living-document use; primary external share format | Both detailed and summary variants |
| Export: Word (.docx) | Living-document use; primary partner share format | Editable in Word; mirrors the PDF content |
| Export: image (PNG) | Embedding in slides | Summary variant primarily |
| Export: data (JSON / CSV) | Hand-off to other tools and Phase 4 | Internal use; not for partners |

### 5.5 Editable specifications table

Below the detailed view, a row-per-task spreadsheet grid lets the team override anything the scheduler picked. **v1 column set:**

| Column | Editable | Source |
|--------|----------|--------|
| Feature | yes | Phase 1 feature name |
| Task | yes | Phase 1 post-it label |
| Discipline | yes | Phase 1 Art/Design/Code |
| Estimate value | yes | Phase 1 |
| Estimate unit | yes | Phase 1 |
| Resolved working days | computed (read-only) | derived |
| Scheduled start | yes (override) | scheduler default |
| Scheduled end | yes (override) | scheduler default |
| Assigned resource | yes | Phase 3 |
| Notes | yes | new |

Edits in this table flow back to Phase 1's data — there is **one source of truth per task**, and the Phase 1 canvas, the timeline, and this grid are three views of the same record.

Manual overrides on `Scheduled start` / `Scheduled end` pin the task; the scheduler routes around pinned tasks on the next re-run. Clearing a pin returns the task to scheduler control.

### 5.6 Cost collector

The phase title is "Scheduling **and Cost Collector**." Cost arrives in Phase 3 (roster carries the rates), but Phase 2 is where the per-task / per-feature cost is **summed and displayed** alongside the timeline. The math:

```
task_cost = working_days × resource_daily_rate
feature_cost = sum(task_cost for tasks in feature)
project_cost = sum(feature_cost) × (1 + contingency_pct)
```

If no roster has been assigned (Phase 3 not yet done), the cost collector shows zeros or a placeholder; the timeline still works on duration alone.

### 5.7 Scheduling algorithm (forward pack)

**[implied — needed to build, derived from phase intent]**

Until dependencies are introduced (out of scope per Jim's notes), the scheduling algorithm is straightforward:

1. Order tasks by feature, then by post-it order within the feature.
2. Per discipline (Art / Design / Code / Production), pack tasks sequentially against that discipline's available capacity.
3. Capacity per discipline is the count of roster members of that discipline × their daily availability (from Phase 3); if Phase 3 is empty, capacity is "1 of each discipline."
4. Apply contingency at the end as a trailing block.

This is a forward-pack scheduler, not a constraint solver. It is fast and re-runs on every edit. Once dependencies are added in a later version, this algorithm extends to a topologically-sorted forward pack.

---

## 6. Phase 3 — Roster

### 6.1 Goal

Add team members to be used to fulfill the tasks set out in the estimation and scheduling phase. Show visually (in the same timeline format) when they roll on and off the project, how much of their time is spent on the project, and any cost attached to them. Their properties should be **editable** and treated as a **resource**.

### 6.2 Resource model

```
Resource
  id, project_id, name, role (Art | Design | Code | Production | Custom),
  roll_on_date, roll_off_date,
  allocation_pct (0-100),   // % of working time on this project
  daily_rate (currency),
  notes
```

### 6.3 Visualization

- Same horizontal timeline format as Phase 2.
- One row per resource.
- Bar from `roll_on_date` to `roll_off_date`.
- Bar shading or label indicates `allocation_pct`.
- Hover on a bar reveals daily rate and total cost contribution.

### 6.4 Editable properties

Every property of a resource is editable inline. Changes flow into Phase 2's cost collector live (no re-run step).

### 6.5 Scope

Resources are **project-scoped**. Each project carries its own roster; there is no master / company-wide roster shared across projects in v1. If the team needs cross-project resource pooling later (a single Sarah whose allocation is split across two pitches), that's a v2 feature and likely warrants a Resource → ProjectResource split in the data model at that time.

---

## 7. Phase 4 — Timeline Generator + Plantastic Integration

### 7.1 Goal

Take the information from Phases 1–3 and show **where the various milestones of this project will be delivered**, with a **"thickness"** added to the line that stretches across a dated timeline to **reflect how many people are on the project at that time**.

### 7.2 Milestone visualization

- A single horizontal line representing the project lifespan, on a dated axis.
- **Milestones come from two sources, both shown:**
  - **Feature-derived milestones.** Each Phase 1 feature emits one milestone, placed on the date its last task ends. Auto-updated as estimates / schedule change.
  - **Manual milestones.** A user can drop a milestone marker anywhere on the line, with a label and an optional date or "after feature X" anchor.
- The two are visually distinguishable (e.g., open circle for derived, filled diamond for manual).
- Line **thickness** at any date is proportional to the number of resources active on the project on that date, computed from Phase 3 roster bars and their allocation percentages.

  ```
  thickness(d) = Σ resource.allocation_pct  for all resources where roll_on_date ≤ d ≤ roll_off_date
  ```

### 7.3 Plantastic integration

Plantastic is Soul Assembly's internal JIRA-style program.

- **Direction:** export from this tool to Plantastic when a pitch project is greenlit and moves into production.
- **Payload:** the full project — features, tasks, estimates, scheduled dates, resources, roster — mapped to Plantastic's equivalent entities.
- **Trigger:** explicit user action ("Push to Plantastic") on the project. Not automatic.
- **Mapping (initial pass):**

| This tool | Plantastic equivalent |
|-----------|-----------------------|
| Project | Project |
| Feature | Epic |
| Post-it / Task | Issue |
| Discipline (Art/Code/Design/Production) | Plantastic discipline (1:1 mapping; Plantastic uses the same four values) |
| Estimate (working days) | Original Estimate (duration) |
| Resource | Assignee + capacity entry |
| Scheduled start/end | Scheduled fields |
| Milestone | Version / fix-version |

- **API contract.** Plantastic's API hookup will be coordinated with the Plantastic team. The adapter module is built last and is isolated so it can be developed against a stub until the live API is available.

### 7.4 Round-trip sync

The integration is **round-trip**: changes in either system flow to the other, including for estimates.

- **Outbound (this tool → Plantastic).** Estimate edits, scheduling changes, roster changes, milestone changes, and discipline assignment all push to Plantastic.
- **Inbound (Plantastic → this tool).** Estimate edits made in Plantastic, status changes, actuals (time logged), and assignment changes pull back into this tool's view of the project. Estimate edits inbound update the post-it's recorded estimate; the canvas re-renders and the timeline re-runs the scheduler.
- **Conflict policy.** Last-write-wins per field by `updated_at` timestamp. There is no "owner" side — both systems are first-class for every shared field.
- **Sync mechanism.** Webhook from Plantastic on change events; outbound push triggered on save. A periodic reconciliation pass (every 15 minutes) catches dropped events.
- **First-run.** The initial export creates Plantastic records and stores their IDs on the local entities for subsequent updates. There is no "delete from Plantastic" operation in v1 — entities deleted in this tool are flagged but not removed upstream.
- **Loop suppression.** Each side stamps its writes with an `origin` field; the receiving side ignores its own echo. Standard pattern; prevents an estimate edit from ping-ponging.

---

## 8. Non-functional requirements

### 8.1 Performance

- Timeline renders update on every edit; target < 200 ms for projects up to ~200 tasks and ~20 resources.
- Re-running the scheduler is implicit (no commit step).

### 8.2 Browser and device support

- **v1 desktop only.** Chrome, Edge, Safari (Mac), Firefox — latest two versions of each. Tablet browsers are best-effort but not a tested target.
- **No phone support in v1.** Mobile / phone is deferred to v2. Hover-based interactions (e.g., mouse-over to enlarge the estimate label, per 4.2) are acceptable in v1 because every supported environment has a pointer.
- **v2 mobile considerations** (future, not in scope for the build): touch-friendly hit targets, pinch-zoom + two-finger pan, hover-fallback interactions, and likely a "list view" fallback for the Phase 1 canvas at narrow widths. Building the data model as it stands now keeps that future v2 work additive — no schema changes required.

### 8.3 Storage size

- A typical pitch project (100 tasks, 10 resources, 6 features) is well under 1 MB serialized JSON. Drive storage is not a constraint at this scale.

### 8.4 Concurrent editing

- Real-time co-editing per 3.2. CRDT layer (Yjs recommended) carries per-element edits; presence channel carries cursor / selection state. Live updates land in well under 200 ms on a typical office network.

---

## 9. Architecture sketch

**[implied — only what is needed to make the spec actionable]**

- **Frontend.** SPA (React recommended; Vue acceptable). Phase 1 canvas built on **Konva** (well-suited for resizable shapes, and gives us touch support for free when mobile lands in v2); Phase 2–4 timelines built on SVG (simpler, lighter, prints well
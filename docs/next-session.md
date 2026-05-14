# Next Session — Pending Work

## 1. Sprints within Milestones

Agreed design, ready to build.

### Data model
- Add `sprintLengthWeeks?: 2 | 3` to `Milestone` in `packages/shared/src/types/project.ts`
- Mirror in `server/internal/models/project.go`
- Sprints are **auto-derived** from milestone date range ÷ sprint length — not stored individually
- Opt-in: milestones without `sprintLengthWeeks` show no sprint subdivision

### Timeline display (Phase 2 milestone lane)
- Subdivide each milestone bar into sprint segments
- Same colour as milestone, stepped opacity: Sprint 1 full → Sprint 2 slightly lighter → Sprint 3 lighter again (cycling)
- Label each segment "S1", "S2" (or "Sprint 1", "Sprint 2" if wide enough)
- Existing hardening period overlay at end of milestone stays unchanged

### Milestone focus view (Phase 3 MilestonesPage)
- Clicking a milestone filters the timeline to show only tasks within that milestone's date range
- X-axis resets to start at the milestone's start day so sprint bands align with task bars
- "Back" / "All milestones" toggle exits the filtered view

### Task-to-sprint assignment
- Tasks automatically placed in a sprint based on their scheduled date (no explicit drag-to-sprint for now)

### Files to touch
1. `packages/shared/src/types/project.ts` — add `sprintLengthWeeks` to Milestone
2. `server/internal/models/project.go` — mirror the field
3. `packages/client/src/features/phase3-milestones/` — sprint length config UI per milestone
4. `packages/client/src/features/phase2-scheduling/components/Timeline.tsx` — sprint band rendering
5. `packages/client/src/features/phase3-milestones/MilestonesPage.tsx` — milestone focus view

---

## 2. Task insertion on the timeline (needs more work)

Forward-push on insert is implemented but not behaving correctly in practice. Need to revisit the snap + insert logic so dragging a task between two adjacent tasks pushes the later one forward cleanly.

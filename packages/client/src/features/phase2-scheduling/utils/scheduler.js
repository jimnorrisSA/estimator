import { WORKING_DAYS } from "@estimator/shared";
const DISCIPLINE_ORDER = ["Art", "Design", "Code", "Production", "Custom"];
// Advance pos past any hardening block it falls inside.
function pushPastBlocks(pos, sorted) {
    let p = pos;
    let pushed = true;
    while (pushed) {
        pushed = false;
        for (const b of sorted) {
            if (p >= b.start && p < b.end) {
                p = b.end;
                pushed = true;
                break;
            }
        }
    }
    return p;
}
// Place a task of `duration` working days starting from `start`, splitting
// around hardening periods.  Returns the first segment start, the last
// segment end, and an array of segments (undefined when there is only one).
export function computeTaskPlacement(start, duration, blocks) {
    if (!blocks.length || duration <= 0) {
        return { startDay: start, endDay: start + duration };
    }
    const sorted = [...blocks].sort((a, b) => a.start - b.start);
    // Advance start past any block it sits inside.
    const pos0 = pushPastBlocks(start, sorted);
    // Fast path: no block interrupts [pos0, pos0 + duration).
    if (!sorted.some(b => b.start > pos0 && b.start < pos0 + duration)) {
        return { startDay: pos0, endDay: pos0 + duration };
    }
    // Build segments, splitting wherever a hardening period interrupts.
    const segs = [];
    let remaining = duration;
    let pos = pos0;
    while (remaining > 0) {
        pos = pushPastBlocks(pos, sorted);
        const next = sorted.find(b => b.start > pos && b.start < pos + remaining);
        if (next) {
            segs.push({ start: pos, end: next.start });
            remaining -= (next.start - pos);
            pos = next.end;
        }
        else {
            segs.push({ start: pos, end: pos + remaining });
            remaining = 0;
        }
    }
    return { startDay: segs[0].start, endDay: segs[segs.length - 1].end, segments: segs };
}
export function runScheduler(features, contingencyPct, overrides, resources, defaultMonthlyRate = 0, blockedPeriods = [], resourceWindows = {}, workingDaysPerMonth = 22) {
    const disciplineSet = new Set();
    for (const f of features)
        for (const g of f.groups)
            disciplineSet.add(g.discipline);
    const disciplines = DISCIPLINE_ORDER.filter((d) => disciplineSet.has(d));
    // Capacity = number of resources per discipline (minimum 1)
    const capacities = {};
    for (const d of disciplines) {
        const count = resources.filter((r) => r.role === d).length;
        capacities[d] = count > 0 ? count : 1;
    }
    // Monthly rate per slot: resources[d][slotIndex].monthlyRate
    const ratesByDiscipline = {};
    for (const d of disciplines) {
        const dr = resources.filter((r) => r.role === d);
        ratesByDiscipline[d] = Array.from({ length: capacities[d] }, (_, i) => dr[i]?.monthlyRate ?? 0);
    }
    // Resources ordered per discipline — slot i maps to disciplineResources[d][i]
    const disciplineResources = {};
    for (const d of disciplines)
        disciplineResources[d] = resources.filter((r) => r.role === d);
    // Multi-cursor forward pack: cursors[d][slot] = next available day
    // Initialise each slot at the resource's roll-on day (0 if unset)
    const cursors = {};
    for (const d of disciplines) {
        cursors[d] = Array.from({ length: capacities[d] }, (_, i) => {
            const r = disciplineResources[d][i];
            return r ? (resourceWindows[r.id]?.startDay ?? 0) : 0;
        });
    }
    const tasks = [];
    for (const feature of features) {
        for (const discipline of disciplines) {
            const group = feature.groups.find((g) => g.discipline === discipline);
            if (!group)
                continue;
            for (const task of group.tasks) {
                const wd = WORKING_DAYS[task.estimate.unit] * task.estimate.value;
                const ov = overrides[task.id];
                const isPinned = ov?.startDay != null;
                const slots = cursors[discipline];
                // Pinned slotIndex takes priority; otherwise pick earliest-available slot,
                // preferring slots that complete before the resource rolls off.
                let slotIndex;
                if (ov?.slotIndex != null) {
                    slotIndex = Math.min(ov.slotIndex, slots.length - 1);
                }
                else if (isPinned) {
                    slotIndex = slots.reduce((best, v, i) => (v < slots[best] ? i : best), 0);
                }
                else {
                    const discRes = disciplineResources[discipline];
                    const fitting = slots.reduce((acc, cursor, i) => {
                        const win = discRes[i] ? resourceWindows[discRes[i].id] : undefined;
                        if (!win?.endDay || cursor + wd <= win.endDay)
                            acc.push(i);
                        return acc;
                    }, []);
                    const candidates = fitting.length > 0 ? fitting : slots.map((_, i) => i);
                    slotIndex = candidates.reduce((best, i) => (slots[i] < slots[best] ? i : best), candidates[0]);
                }
                let placementStart = isPinned && ov.startDay != null ? ov.startDay : slots[slotIndex];
                // Always respect roll-on date — a pinned position before the resource joins is invalid.
                const slotRes = disciplineResources[discipline][slotIndex];
                if (slotRes) {
                    const win = resourceWindows[slotRes.id];
                    if (win && placementStart < win.startDay)
                        placementStart = win.startDay;
                }
                const placement = computeTaskPlacement(placementStart, wd, blockedPeriods);
                const { startDay, endDay } = placement;
                if (isPinned && ov.startDay != null) {
                    slots[slotIndex] = Math.max(slots[slotIndex], endDay);
                }
                else {
                    slots[slotIndex] = endDay;
                }
                const assignedResourceId = ov?.assignedResourceId;
                const assignedResource = assignedResourceId
                    ? resources.find((r) => r.id === assignedResourceId)
                    : undefined;
                const monthlyRate = assignedResource?.monthlyRate || ratesByDiscipline[discipline][slotIndex] || defaultMonthlyRate;
                tasks.push({
                    taskId: task.id,
                    featureId: feature.id,
                    featureName: feature.name,
                    groupId: group.id,
                    discipline,
                    slotIndex,
                    label: task.label,
                    estimateValue: task.estimate.value,
                    estimateUnit: task.estimate.unit,
                    workingDays: wd,
                    startDay,
                    endDay,
                    segments: placement.segments,
                    isPinned,
                    notes: ov?.notes ?? "",
                    cost: wd * (monthlyRate / workingDaysPerMonth),
                    assignedResourceId,
                });
            }
        }
    }
    const totalDays = tasks.length > 0 ? Math.max(...tasks.map((t) => t.endDay)) : 0;
    // Per-slot contingency: each team member's buffer = their own working days × pct
    const slotMap = new Map();
    for (const task of tasks) {
        const key = `${task.discipline}:${task.slotIndex}`;
        const s = slotMap.get(key) ?? { discipline: task.discipline, slotIndex: task.slotIndex, endDay: 0, workDays: 0 };
        s.endDay = Math.max(s.endDay, task.endDay);
        s.workDays += task.workingDays;
        slotMap.set(key, s);
    }
    const slotContingency = Array.from(slotMap.values()).map((s) => ({
        discipline: s.discipline,
        slotIndex: s.slotIndex,
        lastTaskEndDay: s.endDay,
        contingencyDays: Math.ceil((s.workDays * contingencyPct) / 100),
    }));
    const projectEndDay = slotContingency.length > 0
        ? Math.max(...slotContingency.map((s) => s.lastTaskEndDay + s.contingencyDays))
        : totalDays;
    const contingencyDays = projectEndDay - totalDays;
    return {
        tasks,
        capacities,
        totalDays,
        contingencyDays,
        projectEndDay,
        disciplines,
        slotContingency,
        blockedPeriods,
    };
}

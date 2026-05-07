import { WORKING_DAYS } from "@estimator/shared";
const DISCIPLINE_ORDER = ["Art", "Design", "Code", "Production", "Custom"];
export function runScheduler(features, contingencyPct, overrides, resources, defaultDailyRate = 0) {
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
    // Daily rate per slot: resources[d][slotIndex].dailyRate
    const ratesByDiscipline = {};
    for (const d of disciplines) {
        const dr = resources.filter((r) => r.role === d);
        ratesByDiscipline[d] = Array.from({ length: capacities[d] }, (_, i) => dr[i]?.dailyRate ?? 0);
    }
    // Multi-cursor forward pack: cursors[d][slot] = next available day
    const cursors = {};
    for (const d of disciplines)
        cursors[d] = Array(capacities[d]).fill(0);
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
                // Earliest-available slot assignment
                const slotIndex = slots.reduce((best, v, i) => (v < slots[best] ? i : best), 0);
                let startDay;
                let endDay;
                if (isPinned && ov.startDay != null) {
                    startDay = ov.startDay;
                    endDay = ov.endDay ?? startDay + wd;
                    slots[slotIndex] = Math.max(slots[slotIndex], endDay);
                }
                else {
                    startDay = slots[slotIndex];
                    endDay = startDay + wd;
                    slots[slotIndex] = endDay;
                }
                const assignedResourceId = ov?.assignedResourceId;
                const assignedResource = assignedResourceId
                    ? resources.find((r) => r.id === assignedResourceId)
                    : undefined;
                const rate = assignedResource?.dailyRate ?? ratesByDiscipline[discipline][slotIndex] ?? defaultDailyRate;
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
                    isPinned,
                    notes: ov?.notes ?? "",
                    cost: wd * rate,
                    assignedResourceId,
                });
            }
        }
    }
    const totalDays = tasks.length > 0 ? Math.max(...tasks.map((t) => t.endDay)) : 0;
    const contingencyDays = Math.ceil((totalDays * contingencyPct) / 100);
    return {
        tasks,
        capacities,
        totalDays,
        contingencyDays,
        projectEndDay: totalDays + contingencyDays,
        disciplines,
    };
}

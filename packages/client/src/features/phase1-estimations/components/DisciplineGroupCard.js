import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { useCanvasContext } from "../context/CanvasContext.js";
import { GROUP_HEADER_H, TASK_ROW_H, ADD_TASK_H, } from "../utils/layout.js";
const LABEL_FONT = 13;
const EST_FONT = 12;
const HEADER_FONT = 12;
const PAD = 8;
export function DisciplineGroupCard({ group, layout, featureId, selectedId, onSelect, stageScale }) {
    const cardRef = useRef(null);
    const { requestTextEdit, requestEstimateEdit } = useCanvasContext();
    const addTask = useEstimationsStore((s) => s.addTask);
    const updateTaskLabel = useEstimationsStore((s) => s.updateTaskLabel);
    const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
    function screenPos(offsetX, offsetY) {
        const node = cardRef.current;
        if (!node)
            return { x: 0, y: 0 };
        const stage = node.getStage();
        if (!stage)
            return { x: 0, y: 0 };
        const rect = stage.container().getBoundingClientRect();
        const abs = node.getAbsolutePosition();
        return {
            x: rect.left + abs.x + offsetX * stageScale,
            y: rect.top + abs.y + offsetY * stageScale,
        };
    }
    function openTaskEdit(taskId, currentLabel, taskY) {
        const { x, y } = screenPos(PAD, taskY + (TASK_ROW_H - LABEL_FONT) / 2 - 2);
        requestTextEdit({
            value: currentLabel,
            x,
            y,
            width: (layout.width - PAD * 2) * stageScale,
            height: TASK_ROW_H * stageScale,
            fontSize: LABEL_FONT,
            onCommit: (v) => updateTaskLabel(featureId, group.id, taskId, v),
        });
    }
    const EST_HIT_W = 44;
    function openEstimateEdit(taskId, currentValue, currentUnit, taskY) {
        const { x, y } = screenPos(layout.width, taskY + (TASK_ROW_H - EST_FONT) / 2);
        requestEstimateEdit({
            value: currentValue,
            unit: currentUnit,
            x,
            y,
            onCommit: (v, u) => updateTaskEstimate(featureId, group.id, taskId, v, u),
        });
    }
    function handleAddTask() {
        const newTaskY = GROUP_HEADER_H + group.tasks.length * TASK_ROW_H;
        const { x, y } = screenPos(PAD, newTaskY + (TASK_ROW_H - LABEL_FONT) / 2 - 2);
        requestTextEdit({
            value: "",
            x,
            y,
            width: (layout.width - PAD * 2) * stageScale,
            height: TASK_ROW_H * stageScale,
            fontSize: LABEL_FONT,
            onCommit: (v) => {
                if (v.trim())
                    addTask(featureId, group.id, v.trim());
            },
        });
    }
    const headerColor = darken(group.color, 0.12);
    return (_jsxs(Group, { ref: cardRef, x: layout.x, y: layout.y, children: [_jsx(Rect, { width: layout.width, height: layout.height, fill: group.color, cornerRadius: 4, shadowBlur: 4, shadowColor: "rgba(0,0,0,0.3)", shadowOffsetY: 2 }), _jsx(Rect, { width: layout.width, height: GROUP_HEADER_H, fill: headerColor, cornerRadius: [4, 4, 0, 0] }), _jsx(Text, { x: PAD, y: (GROUP_HEADER_H - HEADER_FONT) / 2, width: layout.width - PAD * 2, text: group.discipline.toUpperCase(), fontSize: HEADER_FONT, fontStyle: "bold", fill: "rgba(255,255,255,0.85)", letterSpacing: 0.8 }), group.tasks.map((task, i) => {
                const ty = GROUP_HEADER_H + i * TASK_ROW_H;
                const isSelected = selectedId === task.id;
                const estText = `${task.estimate.value}${unitShort(task.estimate.unit)}`;
                return (_jsxs(Group, { y: ty, onClick: () => onSelect(task.id), onTap: () => onSelect(task.id), onDblClick: () => openTaskEdit(task.id, task.label, ty), onDblTap: () => openTaskEdit(task.id, task.label, ty), children: [isSelected && _jsx(Rect, { width: layout.width, height: TASK_ROW_H, fill: "rgba(255,255,255,0.25)" }), _jsx(Rect, { y: 0, width: layout.width, height: 1, fill: "rgba(0,0,0,0.15)" }), _jsx(Text, { x: PAD, y: (TASK_ROW_H - LABEL_FONT) / 2, width: layout.width - PAD * 2 - EST_HIT_W, text: task.label || "Double-click to label…", fontSize: LABEL_FONT, fill: task.label ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)", ellipsis: true }), _jsx(Text, { x: layout.width - EST_HIT_W, y: (TASK_ROW_H - EST_FONT) / 2, width: EST_HIT_W - PAD, text: estText, fontSize: EST_FONT, fontStyle: "italic", fill: isSelected ? "#f0d9ff" : "rgba(255,255,255,0.65)", align: "right" }), _jsx(Rect, { x: layout.width - EST_HIT_W, y: 0, width: EST_HIT_W, height: TASK_ROW_H, fill: "transparent", onDblClick: (e) => {
                                e.cancelBubble = true;
                                openEstimateEdit(task.id, task.estimate.value, task.estimate.unit, ty);
                            }, onDblTap: (e) => {
                                e.cancelBubble = true;
                                openEstimateEdit(task.id, task.estimate.value, task.estimate.unit, ty);
                            } })] }, task.id));
            }), _jsxs(Group, { y: GROUP_HEADER_H + group.tasks.length * TASK_ROW_H, onClick: handleAddTask, onTap: handleAddTask, children: [_jsx(Rect, { width: layout.width, height: ADD_TASK_H, fill: "transparent" }), _jsx(Text, { x: PAD, y: (ADD_TASK_H - LABEL_FONT) / 2, text: "+ Add task", fontSize: LABEL_FONT, fill: "rgba(255,255,255,0.4)" })] })] }));
}
function unitShort(unit) {
    return { half_day: "½d", day: "d", week: "w", month: "mo" }[unit] ?? unit;
}
function darken(hex, amount) {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amount));
    const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amount));
    const b = Math.max(0, (n & 0xff) - Math.round(255 * amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

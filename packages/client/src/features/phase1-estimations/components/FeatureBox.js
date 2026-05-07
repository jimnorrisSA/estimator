import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Group, Rect, Text } from "react-konva";
import { WORKING_DAYS } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { useCanvasContext } from "../context/CanvasContext.js";
import { DisciplineGroupCard } from "./DisciplineGroupCard.js";
import { featureHeight, computeGroupLayouts, addGroupButtonY, FEATURE_HEADER_H, ADD_GROUP_H, FEATURE_MIN_W, FEATURE_PAD, } from "../utils/layout.js";
const TITLE_FONT = 14;
const COUNTER_FONT = 10;
const COUNTER_W = 110; // reserved width on the right for the counter
export function FeatureBox({ feature, selectedId, onSelect, stageScale }) {
    const groupRef = useRef(null);
    const { registerNode, unregisterNode, requestTextEdit, requestDisciplinePick, requestConfirm } = useCanvasContext();
    const updateFeatureName = useEstimationsStore((s) => s.updateFeatureName);
    const updateFeaturePosition = useEstimationsStore((s) => s.updateFeaturePosition);
    const updateFeatureWidth = useEstimationsStore((s) => s.updateFeatureWidth);
    const deleteFeature = useEstimationsStore((s) => s.deleteFeature);
    const setSelected = useEstimationsStore((s) => s.setSelected);
    const [deleteHover, setDeleteHover] = useState(false);
    const isSelected = selectedId === feature.id;
    const boxH = featureHeight(feature.groups);
    const groupLayouts = computeGroupLayouts(feature);
    const addBtnY = addGroupButtonY(feature);
    // Compute summary counts
    const allTasks = feature.groups.flatMap((g) => g.tasks);
    const totalTasks = allTasks.length;
    const totalDays = allTasks.reduce((sum, t) => sum + WORKING_DAYS[t.estimate.unit] * t.estimate.value, 0);
    const counterText = totalTasks > 0
        ? `${totalTasks} task${totalTasks !== 1 ? "s" : ""} · ${totalDays}d`
        : "";
    useEffect(() => {
        if (groupRef.current)
            registerNode(feature.id, groupRef.current);
        return () => unregisterNode(feature.id);
    }, [feature.id, registerNode, unregisterNode]);
    function handleRename() {
        const node = groupRef.current;
        if (!node)
            return;
        const stage = node.getStage();
        if (!stage)
            return;
        const absPos = node.getAbsolutePosition();
        const containerRect = stage.container().getBoundingClientRect();
        requestTextEdit({
            value: feature.name,
            x: containerRect.left + absPos.x + 10 * stageScale,
            y: containerRect.top + absPos.y + 4 * stageScale,
            width: (feature.width - COUNTER_W - 20) * stageScale,
            height: (FEATURE_HEADER_H - 8) * stageScale,
            fontSize: TITLE_FONT,
            onCommit: (v) => {
                if (v.trim())
                    updateFeatureName(feature.id, v.trim());
            },
        });
    }
    function handleDelete() {
        const taskCount = feature.groups.reduce((n, g) => n + g.tasks.length, 0);
        const taskNote = taskCount > 0
            ? ` This will permanently remove ${taskCount} task${taskCount !== 1 ? "s" : ""}.`
            : "";
        requestConfirm({
            message: `Delete "${feature.name}"?${taskNote}`,
            onConfirm: () => {
                deleteFeature(feature.id);
                setSelected(null);
            },
        });
    }
    function handleAddGroupClick() {
        const node = groupRef.current;
        if (!node)
            return;
        const stage = node.getStage();
        if (!stage)
            return;
        const absPos = node.getAbsolutePosition();
        const containerRect = stage.container().getBoundingClientRect();
        requestDisciplinePick({
            x: containerRect.left + absPos.x + (feature.width / 2) * stageScale,
            y: containerRect.top + absPos.y + addBtnY * stageScale,
            featureId: feature.id,
        });
    }
    return (_jsxs(Group, { ref: groupRef, x: feature.position.x, y: feature.position.y, draggable: true, onClick: () => onSelect(feature.id), onTap: () => onSelect(feature.id), onDragEnd: (e) => {
            updateFeaturePosition(feature.id, { x: e.target.x(), y: e.target.y() });
        }, onTransformEnd: () => {
            const node = groupRef.current;
            const scaleX = node.scaleX();
            node.scaleX(1);
            node.scaleY(1);
            updateFeatureWidth(feature.id, Math.max(FEATURE_MIN_W, feature.width * scaleX));
        }, children: [_jsx(Rect, { width: feature.width, height: boxH, fill: "#f9fafb", stroke: isSelected ? "#3b82f6" : "#d1d5db", strokeWidth: isSelected ? 2 : 1, cornerRadius: 6, shadowBlur: 8, shadowColor: "rgba(0,0,0,0.08)", shadowOffsetY: 2 }), _jsx(Rect, { width: feature.width, height: FEATURE_HEADER_H, fill: "#e5e7eb", cornerRadius: [6, 6, 0, 0], onDblClick: handleRename, onDblTap: handleRename }), _jsx(Text, { x: 10, y: (FEATURE_HEADER_H - TITLE_FONT) / 2, width: feature.width - COUNTER_W - 20, text: feature.name, fontSize: TITLE_FONT, fontStyle: "bold", fill: "#111827", ellipsis: true, onDblClick: handleRename, onDblTap: handleRename }), counterText !== "" && !isSelected && (_jsx(Text, { x: feature.width - COUNTER_W - 8, y: (FEATURE_HEADER_H - COUNTER_FONT) / 2, width: COUNTER_W, text: counterText, fontSize: COUNTER_FONT, fill: "#6b7280", align: "right" })), isSelected && (_jsxs(Group, { x: feature.width - 28, y: (FEATURE_HEADER_H - 20) / 2, onClick: (e) => { e.cancelBubble = true; handleDelete(); }, onTap: (e) => { e.cancelBubble = true; handleDelete(); }, onMouseEnter: () => setDeleteHover(true), onMouseLeave: () => setDeleteHover(false), children: [_jsx(Rect, { width: 20, height: 20, cornerRadius: 4, fill: deleteHover ? "#ef4444" : "#fee2e2" }), _jsx(Text, { width: 20, height: 20, text: "\u00D7", fontSize: 14, fill: deleteHover ? "#ffffff" : "#ef4444", align: "center", verticalAlign: "middle" })] })), feature.groups.length === 0 && (_jsx(Text, { x: FEATURE_PAD, y: FEATURE_HEADER_H + 12, width: feature.width - FEATURE_PAD * 2, text: "Add a discipline to get started", fontSize: 11, fill: "#9ca3af", align: "center", fontStyle: "italic" })), feature.groups.map((g, i) => (_jsx(DisciplineGroupCard, { group: g, layout: groupLayouts[i], featureId: feature.id, selectedId: selectedId, onSelect: onSelect, stageScale: stageScale }, g.id))), _jsxs(Group, { y: addBtnY, onClick: handleAddGroupClick, onTap: handleAddGroupClick, children: [_jsx(Rect, { width: feature.width, height: ADD_GROUP_H, fill: "transparent" }), _jsx(Rect, { x: 10, width: feature.width - 20, height: ADD_GROUP_H, fill: "#f3f4f6", cornerRadius: 4, stroke: "#e5e7eb", strokeWidth: 1 }), _jsx(Text, { x: 10, y: (ADD_GROUP_H - 12) / 2, width: feature.width - 20, text: "+ Add discipline", fontSize: 12, fill: "#6b7280", align: "center" })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Group, Rect, Text } from "react-konva";
import { WORKING_DAYS } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { useCanvasContext } from "../context/CanvasContext.js";
import { useJiraStore } from "../../jira/store/jiraStore.js";
import { DisciplineGroupCard } from "./DisciplineGroupCard.js";
import { featureHeight, computeGroupLayouts, addGroupButtonY, FEATURE_HEADER_H, ADD_GROUP_H, FEATURE_MIN_W, FEATURE_PAD, } from "../utils/layout.js";
const TITLE_FONT = 15;
const COUNTER_FONT = 12;
const COUNTER_W = 110;
export function FeatureBox({ feature, selectedId, onSelect, stageScale }) {
    const groupRef = useRef(null);
    const { registerNode, unregisterNode, getNode, requestTextEdit, requestDisciplinePick, requestConfirm, selectedIds } = useCanvasContext();
    const updateFeatureName = useEstimationsStore((s) => s.updateFeatureName);
    const updateFeaturePosition = useEstimationsStore((s) => s.updateFeaturePosition);
    const updateFeatureWidth = useEstimationsStore((s) => s.updateFeatureWidth);
    const batchUpdateFeaturePositions = useEstimationsStore((s) => s.batchUpdateFeaturePositions);
    const deleteFeature = useEstimationsStore((s) => s.deleteFeature);
    const setSelected = useEstimationsStore((s) => s.setSelected);
    const setSelectedIds = useEstimationsStore((s) => s.setSelectedIds);
    const [deleteHover, setDeleteHover] = useState(false);
    const dragStartRef = useRef(new Map());
    const jiraKey = useJiraStore((s) => s.syncedFeatures[feature.id]);
    const isSelected = selectedIds.includes(feature.id) || selectedId === feature.id;
    const boxH = featureHeight(feature.groups);
    const groupLayouts = computeGroupLayouts(feature);
    const addBtnY = addGroupButtonY(feature);
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
    function handleDragStart() {
        const idsToTrack = selectedIds.includes(feature.id) ? selectedIds : [feature.id];
        const starts = new Map();
        for (const id of idsToTrack) {
            const node = getNode(id);
            if (node)
                starts.set(id, { x: node.x(), y: node.y() });
        }
        dragStartRef.current = starts;
        // Ensure this feature is in the selection when dragging
        if (!selectedIds.includes(feature.id)) {
            setSelectedIds([feature.id]);
            setSelected(feature.id);
        }
    }
    function handleDragMove(e) {
        if (!selectedIds.includes(feature.id) || selectedIds.length <= 1)
            return;
        const startSelf = dragStartRef.current.get(feature.id);
        if (!startSelf)
            return;
        const dx = e.target.x() - startSelf.x;
        const dy = e.target.y() - startSelf.y;
        for (const id of selectedIds) {
            if (id === feature.id)
                continue;
            const other = getNode(id);
            const startOther = dragStartRef.current.get(id);
            if (other && startOther) {
                other.x(startOther.x + dx);
                other.y(startOther.y + dy);
            }
        }
    }
    function handleDragEnd(e) {
        const isMulti = selectedIds.includes(feature.id) && selectedIds.length > 1;
        if (isMulti) {
            const updates = selectedIds.map((id) => {
                if (id === feature.id)
                    return { id, pos: { x: e.target.x(), y: e.target.y() } };
                const node = getNode(id);
                const start = dragStartRef.current.get(id);
                return { id, pos: node ? { x: node.x(), y: node.y() } : (start ?? { x: 0, y: 0 }) };
            });
            batchUpdateFeaturePositions(updates);
        }
        else {
            updateFeaturePosition(feature.id, { x: e.target.x(), y: e.target.y() });
        }
    }
    function handleClick(e) {
        if (e.evt.shiftKey) {
            const newIds = selectedIds.includes(feature.id)
                ? selectedIds.filter((id) => id !== feature.id)
                : [...selectedIds, feature.id];
            setSelectedIds(newIds);
            setSelected(newIds.length === 1 ? newIds[0] : null);
        }
        else {
            setSelectedIds([feature.id]);
            onSelect(feature.id);
        }
    }
    return (_jsxs(Group, { ref: groupRef, x: feature.position.x, y: feature.position.y, draggable: true, onClick: handleClick, onTap: () => { setSelectedIds([feature.id]); onSelect(feature.id); }, onDragStart: handleDragStart, onDragMove: handleDragMove, onDragEnd: handleDragEnd, onTransformEnd: () => {
            const node = groupRef.current;
            const scaleX = node.scaleX();
            node.scaleX(1);
            node.scaleY(1);
            updateFeatureWidth(feature.id, Math.max(FEATURE_MIN_W, feature.width * scaleX));
        }, children: [_jsx(Rect, { width: feature.width, height: boxH, fill: "#1d1930", stroke: isSelected ? "#8b5cf6" : "#2e2848", strokeWidth: isSelected ? 2 : 1, cornerRadius: 6, shadowBlur: 12, shadowColor: "rgba(0,0,0,0.5)", shadowOffsetY: 3 }), _jsx(Rect, { width: feature.width, height: FEATURE_HEADER_H, fill: "#252041", cornerRadius: [6, 6, 0, 0], onDblClick: handleRename, onDblTap: handleRename }), _jsx(Text, { x: 10, y: (FEATURE_HEADER_H - TITLE_FONT) / 2, width: feature.width - COUNTER_W - 20, text: feature.name, fontSize: TITLE_FONT, fontStyle: "bold", fill: "#ece7ff", ellipsis: true, onDblClick: handleRename, onDblTap: handleRename }), counterText !== "" && !isSelected && (_jsx(Text, { x: feature.width - COUNTER_W - 8, y: (FEATURE_HEADER_H - COUNTER_FONT) / 2, width: COUNTER_W, text: counterText, fontSize: COUNTER_FONT, fill: "#5c5575", align: "right" })), isSelected && (_jsxs(Group, { x: feature.width - 28, y: (FEATURE_HEADER_H - 20) / 2, onClick: (e) => { e.cancelBubble = true; handleDelete(); }, onTap: (e) => { e.cancelBubble = true; handleDelete(); }, onMouseEnter: () => setDeleteHover(true), onMouseLeave: () => setDeleteHover(false), children: [_jsx(Rect, { width: 20, height: 20, cornerRadius: 4, fill: deleteHover ? "#ef4444" : "#4b1c1c" }), _jsx(Text, { width: 20, height: 20, text: "\u00D7", fontSize: 14, fill: deleteHover ? "#ffffff" : "#ef4444", align: "center", verticalAlign: "middle" })] })), jiraKey && !isSelected && (_jsxs(Group, { x: feature.width - 6, y: -7, children: [_jsx(Rect, { width: 22, height: 14, cornerRadius: 3, fill: "#0052CC" }), _jsx(Text, { width: 22, height: 14, text: "J", fontSize: 9, fontStyle: "bold", fill: "#ffffff", align: "center", verticalAlign: "middle" })] })), feature.groups.length === 0 && (_jsx(Text, { x: FEATURE_PAD, y: FEATURE_HEADER_H + 12, width: feature.width - FEATURE_PAD * 2, text: "Add a discipline to get started", fontSize: 11, fill: "#3a3456", align: "center", fontStyle: "italic" })), feature.groups.map((g, i) => (_jsx(DisciplineGroupCard, { group: g, layout: groupLayouts[i], featureId: feature.id, selectedId: selectedId, onSelect: onSelect, stageScale: stageScale }, g.id))), _jsxs(Group, { y: addBtnY, onClick: handleAddGroupClick, onTap: handleAddGroupClick, children: [_jsx(Rect, { width: feature.width, height: ADD_GROUP_H, fill: "transparent" }), _jsx(Rect, { x: 10, width: feature.width - 20, height: ADD_GROUP_H, fill: "#1a1628", cornerRadius: 4, stroke: "#2e2848", strokeWidth: 1 }), _jsx(Text, { x: 10, y: (ADD_GROUP_H - 12) / 2, width: feature.width - 20, text: "+ Add discipline", fontSize: 12, fill: "#5c5575", align: "center" })] })] }));
}

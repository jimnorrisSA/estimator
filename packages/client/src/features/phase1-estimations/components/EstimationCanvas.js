import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Transformer, Rect as KonvaRect } from "react-konva";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { CanvasContext } from "../context/CanvasContext.js";
import { FeatureBox } from "./FeatureBox.js";
import { TextOverlay } from "./TextOverlay.js";
import { EstimateOverlay } from "./EstimateOverlay.js";
import { DisciplinePicker } from "./DisciplinePicker.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { featureHeight } from "../utils/layout.js";
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
export function EstimationCanvas() {
    const containerRef = useRef(null);
    const transformerRef = useRef(null);
    const nodeRefs = useRef(new Map());
    const [size, setSize] = useState({ w: 800, h: 600 });
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [textEdit, setTextEdit] = useState(null);
    const [estimateEdit, setEstimateEdit] = useState(null);
    const [disciplinePick, setDisciplinePick] = useState(null);
    const [confirmReq, setConfirmReq] = useState(null);
    const [marquee, setMarquee] = useState(null);
    const [spaceHeld, setSpaceHeld] = useState(false);
    // Refs for interaction state — avoids stale closures in event handlers
    const isPanningRef = useRef(false);
    const panStartRef = useRef(null);
    const marqueeActiveRef = useRef(false);
    const marqueeRef = useRef(null);
    const scaleRef = useRef(scale);
    scaleRef.current = scale;
    const posRef = useRef(pos);
    posRef.current = pos;
    const features = useEstimationsStore((s) => s.features);
    const selectedId = useEstimationsStore((s) => s.selectedId);
    const selectedIds = useEstimationsStore((s) => s.selectedIds);
    const setSelected = useEstimationsStore((s) => s.setSelected);
    const setSelectedIds = useEstimationsStore((s) => s.setSelectedIds);
    const addGroup = useEstimationsStore((s) => s.addGroup);
    // Keep refs to store setters so the window mouseup handler always calls latest version
    const featuresRef = useRef(features);
    featuresRef.current = features;
    const setSelectedRef = useRef(setSelected);
    setSelectedRef.current = setSelected;
    const setSelectedIdsRef = useRef(setSelectedIds);
    setSelectedIdsRef.current = setSelectedIds;
    useEffect(() => {
        const el = containerRef.current;
        if (!el)
            return;
        const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
        ro.observe(el);
        setSize({ w: el.clientWidth, h: el.clientHeight });
        return () => ro.disconnect();
    }, []);
    useEffect(() => {
        function onKeyDown(e) {
            if (e.code === "Space" && !e.repeat) {
                const active = document.activeElement;
                if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
                    return;
                e.preventDefault();
                setSpaceHeld(true);
            }
        }
        function onKeyUp(e) {
            if (e.code === "Space") {
                setSpaceHeld(false);
                isPanningRef.current = false;
                panStartRef.current = null;
            }
        }
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);
    // Window-level mouseup ensures marquee/pan finalize even if mouse leaves the canvas
    useEffect(() => {
        function onWindowMouseUp() {
            if (isPanningRef.current) {
                isPanningRef.current = false;
                panStartRef.current = null;
                return;
            }
            if (marqueeActiveRef.current) {
                marqueeActiveRef.current = false;
                const m = marqueeRef.current;
                marqueeRef.current = null;
                setMarquee(null);
                if (m) {
                    const mx1 = Math.min(m.x1, m.x2);
                    const my1 = Math.min(m.y1, m.y2);
                    const mx2 = Math.max(m.x1, m.x2);
                    const my2 = Math.max(m.y1, m.y2);
                    if (mx2 - mx1 > 5 || my2 - my1 > 5) {
                        const ids = featuresRef.current
                            .filter((f) => {
                            const fh = featureHeight(f.groups);
                            return f.position.x < mx2 && f.position.x + f.width > mx1 && f.position.y < my2 && f.position.y + fh > my1;
                        })
                            .map((f) => f.id);
                        setSelectedIdsRef.current(ids);
                        setSelectedRef.current(ids.length === 1 ? ids[0] : null);
                    }
                    else {
                        setSelectedRef.current(null);
                        setSelectedIdsRef.current([]);
                    }
                }
            }
        }
        window.addEventListener("mouseup", onWindowMouseUp);
        return () => window.removeEventListener("mouseup", onWindowMouseUp);
    }, []);
    useEffect(() => {
        const tr = transformerRef.current;
        if (!tr)
            return;
        const isSingleFeature = selectedIds.length === 1 && features.some((f) => f.id === selectedIds[0]);
        const node = isSingleFeature ? nodeRefs.current.get(selectedIds[0]) : undefined;
        tr.nodes(node ? [node] : []);
        tr.getLayer()?.batchDraw();
    }, [selectedIds, features]);
    const registerNode = useCallback((id, node) => {
        nodeRefs.current.set(id, node);
    }, []);
    const unregisterNode = useCallback((id) => {
        nodeRefs.current.delete(id);
    }, []);
    const getNode = useCallback((id) => nodeRefs.current.get(id), []);
    const requestTextEdit = useCallback((req) => setTextEdit(req), []);
    const requestEstimateEdit = useCallback((req) => setEstimateEdit(req), []);
    const requestDisciplinePick = useCallback((req) => setDisciplinePick(req), []);
    const requestConfirm = useCallback((req) => setConfirmReq(req), []);
    const contextValue = useMemo(() => ({ registerNode, unregisterNode, getNode, requestTextEdit, requestEstimateEdit, requestDisciplinePick, requestConfirm, selectedIds }), [registerNode, unregisterNode, getNode, requestTextEdit, requestEstimateEdit, requestDisciplinePick, requestConfirm, selectedIds]);
    function onWheel(e) {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        const direction = e.evt.deltaY < 0 ? 1 : -1;
        const factor = 1.08;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, direction > 0 ? oldScale * factor : oldScale / factor));
        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };
        setScale(newScale);
        setPos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    }
    function onStageMouseDown(e) {
        if (e.target !== e.target.getStage())
            return;
        const isMiddle = e.evt.button === 1;
        if (isMiddle)
            e.evt.preventDefault();
        if (spaceHeld || isMiddle) {
            isPanningRef.current = true;
            panStartRef.current = {
                mouseX: e.evt.clientX,
                mouseY: e.evt.clientY,
                stageX: posRef.current.x,
                stageY: posRef.current.y,
            };
            return;
        }
        const stage = e.target.getStage();
        const pt = stage.getPointerPosition();
        const cx = (pt.x - posRef.current.x) / scaleRef.current;
        const cy = (pt.y - posRef.current.y) / scaleRef.current;
        marqueeActiveRef.current = true;
        marqueeRef.current = { x1: cx, y1: cy, x2: cx, y2: cy };
        setMarquee({ x1: cx, y1: cy, x2: cx, y2: cy });
    }
    function onStageMouseMove(e) {
        if (isPanningRef.current && panStartRef.current) {
            const dx = e.evt.clientX - panStartRef.current.mouseX;
            const dy = e.evt.clientY - panStartRef.current.mouseY;
            setPos({ x: panStartRef.current.stageX + dx, y: panStartRef.current.stageY + dy });
            return;
        }
        if (marqueeActiveRef.current && marqueeRef.current) {
            const stage = e.target.getStage();
            if (!stage)
                return;
            const pt = stage.getPointerPosition();
            const cx = (pt.x - posRef.current.x) / scaleRef.current;
            const cy = (pt.y - posRef.current.y) / scaleRef.current;
            marqueeRef.current = { ...marqueeRef.current, x2: cx, y2: cy };
            setMarquee({ ...marqueeRef.current });
        }
    }
    function handleDisciplinePick(featureId, discipline) {
        addGroup(featureId, discipline);
    }
    const cursor = spaceHeld ? "grab" : "default";
    return (_jsx(CanvasContext.Provider, { value: contextValue, children: _jsxs("div", { ref: containerRef, className: "w-full h-full relative overflow-hidden bg-[#0d0b16]", style: { cursor, userSelect: "none" }, children: [_jsx("div", { className: "absolute inset-0 pointer-events-none", style: {
                        backgroundImage: "radial-gradient(circle, #231d3a 1px, transparent 1px)",
                        backgroundSize: "24px 24px",
                    } }), _jsx(Stage, { width: size.w, height: size.h, scaleX: scale, scaleY: scale, x: pos.x, y: pos.y, onWheel: onWheel, onMouseDown: onStageMouseDown, onMouseMove: onStageMouseMove, onClick: (e) => {
                        if (e.target === e.target.getStage()) {
                            setSelected(null);
                            setSelectedIds([]);
                        }
                    }, children: _jsxs(Layer, { children: [features.map((f) => (_jsx(FeatureBox, { feature: f, selectedId: selectedId, onSelect: setSelected, stageScale: scale }, f.id))), _jsx(Transformer, { ref: transformerRef, rotateEnabled: false, enabledAnchors: ["middle-left", "middle-right"], boundBoxFunc: (oldBox, newBox) => (newBox.width < 280 ? oldBox : newBox) }), marquee && (_jsx(KonvaRect, { x: Math.min(marquee.x1, marquee.x2), y: Math.min(marquee.y1, marquee.y2), width: Math.abs(marquee.x2 - marquee.x1), height: Math.abs(marquee.y2 - marquee.y1), fill: "rgba(139, 92, 246, 0.08)", stroke: "#8b5cf6", strokeWidth: 1 / scale, dash: [4 / scale, 4 / scale], listening: false }))] }) }), textEdit && _jsx(TextOverlay, { edit: textEdit, onDone: () => setTextEdit(null) }), estimateEdit && _jsx(EstimateOverlay, { edit: estimateEdit, onDone: () => setEstimateEdit(null) }), disciplinePick && (_jsx(DisciplinePicker, { req: disciplinePick, onPick: handleDisciplinePick, onDone: () => setDisciplinePick(null) })), confirmReq && (_jsx(ConfirmDialog, { req: confirmReq, onDone: () => setConfirmReq(null) }))] }) }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Transformer } from "react-konva";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { CanvasContext } from "../context/CanvasContext.js";
import { FeatureBox } from "./FeatureBox.js";
import { TextOverlay } from "./TextOverlay.js";
import { EstimateOverlay } from "./EstimateOverlay.js";
import { DisciplinePicker } from "./DisciplinePicker.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
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
    const features = useEstimationsStore((s) => s.features);
    const selectedId = useEstimationsStore((s) => s.selectedId);
    const setSelected = useEstimationsStore((s) => s.setSelected);
    const addGroup = useEstimationsStore((s) => s.addGroup);
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
        const tr = transformerRef.current;
        if (!tr)
            return;
        const isFeature = features.some((f) => f.id === selectedId);
        const node = isFeature && selectedId ? nodeRefs.current.get(selectedId) : undefined;
        tr.nodes(node ? [node] : []);
        tr.getLayer()?.batchDraw();
    }, [selectedId, features]);
    const registerNode = useCallback((id, node) => {
        nodeRefs.current.set(id, node);
    }, []);
    const unregisterNode = useCallback((id) => {
        nodeRefs.current.delete(id);
    }, []);
    const requestTextEdit = useCallback((req) => {
        setTextEdit(req);
    }, []);
    const requestEstimateEdit = useCallback((req) => {
        setEstimateEdit(req);
    }, []);
    const requestDisciplinePick = useCallback((req) => {
        setDisciplinePick(req);
    }, []);
    const requestConfirm = useCallback((req) => {
        setConfirmReq(req);
    }, []);
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
    function handleDisciplinePick(featureId, discipline) {
        addGroup(featureId, discipline);
    }
    return (_jsx(CanvasContext.Provider, { value: { registerNode, unregisterNode, requestTextEdit, requestEstimateEdit, requestDisciplinePick, requestConfirm }, children: _jsxs("div", { ref: containerRef, className: "w-full h-full relative overflow-hidden bg-[#0d0b16]", children: [_jsx("div", { className: "absolute inset-0 pointer-events-none", style: {
                        backgroundImage: "radial-gradient(circle, #231d3a 1px, transparent 1px)",
                        backgroundSize: "24px 24px",
                    } }), _jsx(Stage, { width: size.w, height: size.h, scaleX: scale, scaleY: scale, x: pos.x, y: pos.y, draggable: true, onWheel: onWheel, onDragEnd: (e) => {
                        const stage = e.target;
                        setPos({ x: stage.x(), y: stage.y() });
                    }, onClick: (e) => {
                        if (e.target === e.target.getStage())
                            setSelected(null);
                    }, children: _jsxs(Layer, { children: [features.map((f) => (_jsx(FeatureBox, { feature: f, selectedId: selectedId, onSelect: setSelected, stageScale: scale }, f.id))), _jsx(Transformer, { ref: transformerRef, rotateEnabled: false, enabledAnchors: ["middle-left", "middle-right"], boundBoxFunc: (oldBox, newBox) => (newBox.width < 280 ? oldBox : newBox) })] }) }), textEdit && _jsx(TextOverlay, { edit: textEdit, onDone: () => setTextEdit(null) }), estimateEdit && _jsx(EstimateOverlay, { edit: estimateEdit, onDone: () => setEstimateEdit(null) }), disciplinePick && (_jsx(DisciplinePicker, { req: disciplinePick, onPick: handleDisciplinePick, onDone: () => setDisciplinePick(null) })), confirmReq && (_jsx(ConfirmDialog, { req: confirmReq, onDone: () => setConfirmReq(null) }))] }) }));
}

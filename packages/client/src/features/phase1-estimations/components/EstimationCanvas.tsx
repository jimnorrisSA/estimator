import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Transformer } from "react-konva";
import type Konva from "konva";
import type { Discipline } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { CanvasContext, type TextEditRequest, type EstimateEditRequest, type DisciplinePickRequest, type ConfirmRequest } from "../context/CanvasContext.js";
import { FeatureBox } from "./FeatureBox.js";
import { TextOverlay } from "./TextOverlay.js";
import { EstimateOverlay } from "./EstimateOverlay.js";
import { DisciplinePicker } from "./DisciplinePicker.js";
import { ConfirmDialog } from "./ConfirmDialog.js";

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

export function EstimationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());

  const [size, setSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [textEdit, setTextEdit] = useState<TextEditRequest | null>(null);
  const [estimateEdit, setEstimateEdit] = useState<EstimateEditRequest | null>(null);
  const [disciplinePick, setDisciplinePick] = useState<DisciplinePickRequest | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);

  const features = useEstimationsStore((s) => s.features);
  const selectedId = useEstimationsStore((s) => s.selectedId);
  const setSelected = useEstimationsStore((s) => s.setSelected);
  const addGroup = useEstimationsStore((s) => s.addGroup);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const isFeature = features.some((f) => f.id === selectedId);
    const node = isFeature && selectedId ? nodeRefs.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, features]);

  const registerNode = useCallback((id: string, node: Konva.Node) => {
    nodeRefs.current.set(id, node);
  }, []);

  const unregisterNode = useCallback((id: string) => {
    nodeRefs.current.delete(id);
  }, []);

  const requestTextEdit = useCallback((req: TextEditRequest) => {
    setTextEdit(req);
  }, []);

  const requestEstimateEdit = useCallback((req: EstimateEditRequest) => {
    setEstimateEdit(req);
  }, []);

  const requestDisciplinePick = useCallback((req: DisciplinePickRequest) => {
    setDisciplinePick(req);
  }, []);

  const requestConfirm = useCallback((req: ConfirmRequest) => {
    setConfirmReq(req);
  }, []);

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = e.target.getStage()!;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition()!;
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

  function handleDisciplinePick(featureId: string, discipline: Discipline) {
    addGroup(featureId, discipline);
  }

  return (
    <CanvasContext.Provider value={{ registerNode, unregisterNode, requestTextEdit, requestEstimateEdit, requestDisciplinePick, requestConfirm }}>
      <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#0d0b16]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #231d3a 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <Stage
          width={size.w}
          height={size.h}
          scaleX={scale}
          scaleY={scale}
          x={pos.x}
          y={pos.y}
          draggable
          onWheel={onWheel}
          onDragEnd={(e) => {
            const stage = e.target as Konva.Stage;
            setPos({ x: stage.x(), y: stage.y() });
          }}
          onClick={(e) => {
            if (e.target === e.target.getStage()) setSelected(null);
          }}
        >
          <Layer>
            {features.map((f) => (
              <FeatureBox
                key={f.id}
                feature={f}
                selectedId={selectedId}
                onSelect={setSelected}
                stageScale={scale}
              />
            ))}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              enabledAnchors={["middle-left", "middle-right"]}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 280 ? oldBox : newBox)}
            />
          </Layer>
        </Stage>

        {textEdit && <TextOverlay edit={textEdit} onDone={() => setTextEdit(null)} />}
        {estimateEdit && <EstimateOverlay edit={estimateEdit} onDone={() => setEstimateEdit(null)} />}
        {disciplinePick && (
          <DisciplinePicker
            req={disciplinePick}
            onPick={handleDisciplinePick}
            onDone={() => setDisciplinePick(null)}
          />
        )}
        {confirmReq && (
          <ConfirmDialog req={confirmReq} onDone={() => setConfirmReq(null)} />
        )}
      </div>
    </CanvasContext.Provider>
  );
}

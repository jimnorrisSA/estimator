import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Transformer } from "react-konva";
import type Konva from "konva";
import type { Discipline } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { CanvasContext, type TextEditRequest, type DisciplinePickRequest } from "../context/CanvasContext.js";
import { FeatureBox } from "./FeatureBox.js";
import { TextOverlay } from "./TextOverlay.js";
import { DisciplinePicker } from "./DisciplinePicker.js";

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
  const [disciplinePick, setDisciplinePick] = useState<DisciplinePickRequest | null>(null);

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

  // Only attach Transformer to feature-level nodes (horizontal resize only)
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

  const requestDisciplinePick = useCallback((req: DisciplinePickRequest) => {
    setDisciplinePick(req);
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
    <CanvasContext.Provider value={{ registerNode, unregisterNode, requestTextEdit, requestDisciplinePick }}>
      <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-gray-100">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
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
            {/* Horizontal-only resize for feature boxes */}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              enabledAnchors={["middle-left", "middle-right"]}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 280 ? oldBox : newBox)}
            />
          </Layer>
        </Stage>

        {textEdit && <TextOverlay edit={textEdit} onDone={() => setTextEdit(null)} />}
        {disciplinePick && (
          <DisciplinePicker
            req={disciplinePick}
            onPick={handleDisciplinePick}
            onDone={() => setDisciplinePick(null)}
          />
        )}
      </div>
    </CanvasContext.Provider>
  );
}

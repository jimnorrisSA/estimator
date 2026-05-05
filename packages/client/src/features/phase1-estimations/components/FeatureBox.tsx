import { useEffect, useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { Feature } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { useCanvasContext } from "../context/CanvasContext.js";
import { PostItNote } from "./PostItNote.js";
import { FEATURE_HEADER_H } from "../utils/defaults.js";

const TITLE_FONT = 14;

interface Props {
  feature: Feature;
  selectedId: string | null;
  onSelect: (id: string) => void;
  stageScale: number;
}

export function FeatureBox({ feature, selectedId, onSelect, stageScale }: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const { registerNode, unregisterNode, requestTextEdit } = useCanvasContext();
  const updateFeaturePosition = useEstimationsStore((s) => s.updateFeaturePosition);
  const updateFeatureSize = useEstimationsStore((s) => s.updateFeatureSize);

  const isSelected = selectedId === feature.id;

  useEffect(() => {
    if (groupRef.current) registerNode(feature.id, groupRef.current);
    return () => unregisterNode(feature.id);
  }, [feature.id, registerNode, unregisterNode]);

  function openNameEdit() {
    const node = groupRef.current;
    if (!node) return;
    const stage = node.getStage();
    if (!stage) return;
    const container = stage.container().getBoundingClientRect();
    const absPos = node.getAbsolutePosition();
    const scale = stageScale;

    requestTextEdit({
      value: feature.name,
      x: container.left + absPos.x * scale + 8,
      y: container.top + absPos.y * scale + 4,
      width: (feature.width - 16) / scale,
      height: (FEATURE_HEADER_H - 8) / scale,
      fontSize: TITLE_FONT,
      onCommit: () => {
        // Feature rename propagation is deferred to v2; name edits stubbed here
      },
    });
  }

  return (
    <Group
      ref={groupRef}
      x={feature.position.x}
      y={feature.position.y}
      draggable
      onClick={() => onSelect(feature.id)}
      onTap={() => onSelect(feature.id)}
      onDblClick={openNameEdit}
      onDblTap={openNameEdit}
      onDragEnd={(e) => {
        updateFeaturePosition(feature.id, { x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={() => {
        const node = groupRef.current!;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        updateFeatureSize(
          feature.id,
          Math.max(200, feature.width * scaleX),
          Math.max(200, feature.height * scaleY)
        );
      }}
    >
      {/* Box background */}
      <Rect
        width={feature.width}
        height={feature.height}
        fill="#f9fafb"
        stroke={isSelected ? "#3b82f6" : "#d1d5db"}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={6}
        shadowBlur={8}
        shadowColor="rgba(0,0,0,0.08)"
        shadowOffsetY={2}
      />

      {/* Header bar */}
      <Rect
        width={feature.width}
        height={FEATURE_HEADER_H}
        fill="#e5e7eb"
        cornerRadius={[6, 6, 0, 0]}
      />
      <Text
        x={10}
        y={10}
        width={feature.width - 20}
        height={FEATURE_HEADER_H - 10}
        text={feature.name}
        fontSize={TITLE_FONT}
        fontStyle="bold"
        fill="#111827"
        ellipsis
      />

      {/* Post-its */}
      {feature.postits.map((p) => (
        <PostItNote
          key={p.id}
          postit={p}
          featureId={feature.id}
          featureWidth={feature.width}
          featureHeight={feature.height}
          isSelected={selectedId === p.id}
          onSelect={onSelect}
          stageScale={stageScale}
        />
      ))}
    </Group>
  );
}

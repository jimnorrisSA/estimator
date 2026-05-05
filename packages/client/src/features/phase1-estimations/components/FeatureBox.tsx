import { useEffect, useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { Feature } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { useCanvasContext } from "../context/CanvasContext.js";
import { DisciplineGroupCard } from "./DisciplineGroupCard.js";
import {
  featureHeight,
  computeGroupLayouts,
  addGroupButtonY,
  FEATURE_HEADER_H,
  ADD_GROUP_H,
  FEATURE_MIN_W,
} from "../utils/layout.js";

const TITLE_FONT = 14;

interface Props {
  feature: Feature;
  selectedId: string | null;
  onSelect: (id: string) => void;
  stageScale: number;
}

export function FeatureBox({ feature, selectedId, onSelect, stageScale }: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const { registerNode, unregisterNode, requestDisciplinePick } = useCanvasContext();
  const updateFeaturePosition = useEstimationsStore((s) => s.updateFeaturePosition);
  const updateFeatureWidth = useEstimationsStore((s) => s.updateFeatureWidth);

  const isSelected = selectedId === feature.id;
  const boxH = featureHeight(feature.groups);
  const groupLayouts = computeGroupLayouts(feature);
  const addBtnY = addGroupButtonY(feature);

  useEffect(() => {
    if (groupRef.current) registerNode(feature.id, groupRef.current);
    return () => unregisterNode(feature.id);
  }, [feature.id, registerNode, unregisterNode]);

  function handleAddGroupClick() {
    const node = groupRef.current;
    if (!node) return;
    const stage = node.getStage();
    if (!stage) return;
    const absPos = node.getAbsolutePosition();
    const containerRect = stage.container().getBoundingClientRect();
    requestDisciplinePick({
      x: containerRect.left + (absPos.x + FEATURE_MIN_W / 2) * stageScale,
      y: containerRect.top + (absPos.y + addBtnY) * stageScale,
      featureId: feature.id,
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
      onDragEnd={(e) => {
        updateFeaturePosition(feature.id, { x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={() => {
        const node = groupRef.current!;
        const scaleX = node.scaleX();
        node.scaleX(1);
        node.scaleY(1);
        updateFeatureWidth(feature.id, Math.max(FEATURE_MIN_W, feature.width * scaleX));
      }}
    >
      {/* Box background */}
      <Rect
        width={feature.width}
        height={boxH}
        fill="#f9fafb"
        stroke={isSelected ? "#3b82f6" : "#d1d5db"}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={6}
        shadowBlur={8}
        shadowColor="rgba(0,0,0,0.08)"
        shadowOffsetY={2}
      />

      {/* Header */}
      <Rect width={feature.width} height={FEATURE_HEADER_H} fill="#e5e7eb" cornerRadius={[6, 6, 0, 0]} />
      <Text
        x={10}
        y={11}
        width={feature.width - 20}
        text={feature.name}
        fontSize={TITLE_FONT}
        fontStyle="bold"
        fill="#111827"
        ellipsis
      />

      {/* Discipline group cards */}
      {feature.groups.map((g, i) => (
        <DisciplineGroupCard
          key={g.id}
          group={g}
          layout={groupLayouts[i]}
          featureId={feature.id}
          selectedId={selectedId}
          onSelect={onSelect}
          stageScale={stageScale}
        />
      ))}

      {/* Add discipline button */}
      <Group y={addBtnY} onClick={handleAddGroupClick} onTap={handleAddGroupClick}>
        <Rect
          width={feature.width}
          height={ADD_GROUP_H}
          fill="transparent"
        />
        <Rect
          x={10}
          width={feature.width - 20}
          height={ADD_GROUP_H}
          fill="#f3f4f6"
          cornerRadius={4}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        <Text
          x={10}
          y={(ADD_GROUP_H - 12) / 2}
          width={feature.width - 20}
          text="+ Add discipline"
          fontSize={12}
          fill="#6b7280"
          align="center"
        />
      </Group>
    </Group>
  );
}

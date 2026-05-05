import { useEffect, useRef, useState } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { PostIt } from "@estimator/shared";
import { WORKING_DAYS } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { useCanvasContext } from "../context/CanvasContext.js";

const LABEL_FONT = 13;
const ESTIMATE_FONT = 11;
const ESTIMATE_FONT_HOVER = 15;
const PADDING = 8;
const DISCIPLINE_LABEL_H = 18;

interface Props {
  postit: PostIt;
  featureId: string;
  featureWidth: number;
  featureHeight: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  stageScale: number;
}

export function PostItNote({
  postit,
  featureId,
  featureWidth,
  featureHeight,
  isSelected,
  onSelect,
  stageScale,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const { registerNode, unregisterNode, requestTextEdit } = useCanvasContext();
  const updatePostItPosition = useEstimationsStore((s) => s.updatePostItPosition);
  const updatePostItSize = useEstimationsStore((s) => s.updatePostItSize);
  const updatePostItLabel = useEstimationsStore((s) => s.updatePostItLabel);
  const [estimateHover, setEstimateHover] = useState(false);

  useEffect(() => {
    if (groupRef.current) registerNode(postit.id, groupRef.current);
    return () => unregisterNode(postit.id);
  }, [postit.id, registerNode, unregisterNode]);

  const wd = WORKING_DAYS[postit.estimate.unit] * postit.estimate.value;
  const estimateText = `${postit.estimate.value} ${postit.estimate.unit.replace("_", "-")} (${wd}d)`;

  function openLabelEdit() {
    const node = groupRef.current;
    if (!node) return;
    const stage = node.getStage();
    if (!stage) return;
    const container = stage.container().getBoundingClientRect();
    const absPos = node.getAbsolutePosition();
    const scale = stageScale;

    requestTextEdit({
      value: postit.taskLabel,
      x: container.left + absPos.x * scale + PADDING,
      y: container.top + absPos.y * scale + DISCIPLINE_LABEL_H + PADDING,
      width: (postit.width - PADDING * 2) / scale,
      height: (postit.height * 0.5) / scale,
      fontSize: LABEL_FONT,
      onCommit: (v) => updatePostItLabel(featureId, postit.id, v),
    });
  }

  function dragBound(pos: { x: number; y: number }) {
    return {
      x: Math.max(0, Math.min(pos.x, featureWidth - postit.width)),
      y: Math.max(0, Math.min(pos.y, featureHeight - postit.height)),
    };
  }

  return (
    <Group
      ref={groupRef}
      x={postit.position.x}
      y={postit.position.y}
      draggable
      dragBoundFunc={dragBound}
      onClick={() => onSelect(postit.id)}
      onTap={() => onSelect(postit.id)}
      onDblClick={openLabelEdit}
      onDblTap={openLabelEdit}
      onDragEnd={(e) => {
        updatePostItPosition(featureId, postit.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={() => {
        const node = groupRef.current!;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        updatePostItSize(
          featureId,
          postit.id,
          Math.max(80, postit.width * scaleX),
          Math.max(80, postit.height * scaleY)
        );
      }}
    >
      {/* Background */}
      <Rect
        width={postit.width}
        height={postit.height}
        fill={postit.color}
        shadowBlur={isSelected ? 0 : 4}
        shadowColor="rgba(0,0,0,0.15)"
        shadowOffsetX={2}
        shadowOffsetY={2}
        cornerRadius={3}
        stroke={isSelected ? "#3b82f6" : undefined}
        strokeWidth={isSelected ? 2 : 0}
      />

      {/* Discipline label strip */}
      <Rect width={postit.width} height={DISCIPLINE_LABEL_H} fill="rgba(0,0,0,0.12)" cornerRadius={[3, 3, 0, 0]} />
      <Text
        x={PADDING}
        y={4}
        width={postit.width - PADDING * 2}
        height={DISCIPLINE_LABEL_H - 4}
        text={postit.discipline}
        fontSize={10}
        fontStyle="bold"
        fill="rgba(0,0,0,0.6)"
        ellipsis
      />

      {/* Task label */}
      <Text
        x={PADDING}
        y={DISCIPLINE_LABEL_H + PADDING}
        width={postit.width - PADDING * 2}
        height={postit.height * 0.45}
        text={postit.taskLabel || "Double-click to add task…"}
        fontSize={LABEL_FONT}
        fill={postit.taskLabel ? "#1f2937" : "#9ca3af"}
        wrap="word"
        ellipsis
      />

      {/* Estimate */}
      <Text
        x={PADDING}
        y={postit.height - (estimateHover ? ESTIMATE_FONT_HOVER : ESTIMATE_FONT) - PADDING - 2}
        width={postit.width - PADDING * 2}
        text={estimateText}
        fontSize={estimateHover ? ESTIMATE_FONT_HOVER : ESTIMATE_FONT}
        fill="#374151"
        fontStyle="italic"
        onMouseEnter={() => setEstimateHover(true)}
        onMouseLeave={() => setEstimateHover(false)}
      />
    </Group>
  );
}

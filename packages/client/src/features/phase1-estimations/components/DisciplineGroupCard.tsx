import { useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { DisciplineGroup, EstimateUnit } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { useCanvasContext } from "../context/CanvasContext.js";
import {
  GROUP_HEADER_H,
  TASK_ROW_H,
  ADD_TASK_H,
} from "../utils/layout.js";
import type { GroupLayout } from "../utils/layout.js";

const LABEL_FONT = 13;
const EST_FONT = 12;
const HEADER_FONT = 12;
const PAD = 8;

interface Props {
  group: DisciplineGroup;
  layout: GroupLayout;
  featureId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  stageScale: number;
}

export function DisciplineGroupCard({ group, layout, featureId, selectedId, onSelect, stageScale }: Props) {
  const cardRef = useRef<Konva.Group>(null);
  const { requestTextEdit, requestEstimateEdit } = useCanvasContext();
  const addTask = useEstimationsStore((s) => s.addTask);
  const updateTaskLabel = useEstimationsStore((s) => s.updateTaskLabel);
  const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);

  // Get the screen-space position of a point (offsetX, offsetY) within this card.
  // getAbsolutePosition() returns canvas-element-pixel coords (stage scale + pan already applied).
  function screenPos(offsetX: number, offsetY: number) {
    const node = cardRef.current;
    if (!node) return { x: 0, y: 0 };
    const stage = node.getStage();
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.container().getBoundingClientRect();
    const abs = node.getAbsolutePosition();
    return {
      x: rect.left + abs.x + offsetX * stageScale,
      y: rect.top + abs.y + offsetY * stageScale,
    };
  }

  function openTaskEdit(taskId: string, currentLabel: string, taskY: number) {
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

  function openEstimateEdit(taskId: string, currentValue: number, currentUnit: EstimateUnit, taskY: number) {
    // Position the overlay so its right edge aligns with the right edge of the estimate text
    const { x, y } = screenPos(layout.width, taskY + (TASK_ROW_H - EST_FONT) / 2);
    requestEstimateEdit({
      value: currentValue,
      unit: currentUnit,
      x,
      y,
      onCommit: (v, u) => updateTaskEstimate(featureId, group.id, taskId, v, u),
    });
  }

  // Don't add task to store until the user actually commits a label
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
        if (v.trim()) addTask(featureId, group.id, v.trim());
      },
    });
  }

  const headerColor = darken(group.color, 0.15);

  return (
    <Group ref={cardRef} x={layout.x} y={layout.y}>
      {/* Card background */}
      <Rect
        width={layout.width}
        height={layout.height}
        fill={group.color}
        cornerRadius={4}
        shadowBlur={3}
        shadowColor="rgba(0,0,0,0.1)"
        shadowOffsetY={1}
      />

      {/* Header */}
      <Rect width={layout.width} height={GROUP_HEADER_H} fill={headerColor} cornerRadius={[4, 4, 0, 0]} />
      <Text
        x={PAD}
        y={(GROUP_HEADER_H - HEADER_FONT) / 2}
        width={layout.width - PAD * 2}
        text={group.discipline.toUpperCase()}
        fontSize={HEADER_FONT}
        fontStyle="bold"
        fill="rgba(0,0,0,0.65)"
        letterSpacing={0.8}
      />

      {/* Task rows */}
      {group.tasks.map((task, i) => {
        const ty = GROUP_HEADER_H + i * TASK_ROW_H;
        const isSelected = selectedId === task.id;
        const estText = `${task.estimate.value}${unitShort(task.estimate.unit)}`;

        return (
          <Group
            key={task.id}
            y={ty}
            onClick={() => onSelect(task.id)}
            onTap={() => onSelect(task.id)}
            onDblClick={() => openTaskEdit(task.id, task.label, ty)}
            onDblTap={() => openTaskEdit(task.id, task.label, ty)}
          >
            {isSelected && <Rect width={layout.width} height={TASK_ROW_H} fill="rgba(255,255,255,0.5)" />}
            <Rect y={0} width={layout.width} height={1} fill="rgba(0,0,0,0.06)" />
            <Text
              x={PAD}
              y={(TASK_ROW_H - LABEL_FONT) / 2}
              width={layout.width - PAD * 2 - EST_HIT_W}
              text={task.label || "Double-click to label…"}
              fontSize={LABEL_FONT}
              fill={task.label ? "#1f2937" : "#9ca3af"}
              ellipsis
            />
            <Text
              x={layout.width - EST_HIT_W}
              y={(TASK_ROW_H - EST_FONT) / 2}
              width={EST_HIT_W - PAD}
              text={estText}
              fontSize={EST_FONT}
              fontStyle="italic"
              fill={isSelected ? "#1d4ed8" : "#374151"}
              align="right"
            />
            {/* Invisible hit area over estimate — double-click opens estimate editor */}
            <Rect
              x={layout.width - EST_HIT_W}
              y={0}
              width={EST_HIT_W}
              height={TASK_ROW_H}
              fill="transparent"
              onDblClick={(e) => {
                e.cancelBubble = true;
                openEstimateEdit(task.id, task.estimate.value, task.estimate.unit, ty);
              }}
              onDblTap={(e) => {
                e.cancelBubble = true;
                openEstimateEdit(task.id, task.estimate.value, task.estimate.unit, ty);
              }}
            />
          </Group>
        );
      })}

      {/* Add task row */}
      <Group
        y={GROUP_HEADER_H + group.tasks.length * TASK_ROW_H}
        onClick={handleAddTask}
        onTap={handleAddTask}
      >
        <Rect width={layout.width} height={ADD_TASK_H} fill="transparent" />
        <Text
          x={PAD}
          y={(ADD_TASK_H - LABEL_FONT) / 2}
          text="+ Add task"
          fontSize={LABEL_FONT}
          fill="rgba(0,0,0,0.35)"
        />
      </Group>
    </Group>
  );
}

function unitShort(unit: string): string {
  return { half_day: "½d", day: "d", week: "w", month: "mo" }[unit] ?? unit;
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amount));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

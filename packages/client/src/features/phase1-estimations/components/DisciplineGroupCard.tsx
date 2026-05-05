import { Group, Rect, Text } from "react-konva";
import type { DisciplineGroup } from "@estimator/shared";
import { useEstimationsStore } from "../store/estimationsStore.js";
import { useCanvasContext } from "../context/CanvasContext.js";
import {
  GROUP_HEADER_H,
  TASK_ROW_H,
  ADD_TASK_H,
} from "../utils/layout.js";
import type { GroupLayout } from "../utils/layout.js";

const LABEL_FONT = 12;
const EST_FONT = 11;
const HEADER_FONT = 11;
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
  const { requestTextEdit } = useCanvasContext();
  const addTask = useEstimationsStore((s) => s.addTask);
  const updateTaskLabel = useEstimationsStore((s) => s.updateTaskLabel);

  function openTaskEdit(taskId: string, currentLabel: string, taskY: number) {
    const absX = layout.x;
    const absY = layout.y + taskY;
    requestTextEdit({
      value: currentLabel,
      x: absX * stageScale + PAD,
      y: absY * stageScale + 2,
      width: (layout.width - PAD * 2) * stageScale,
      height: (TASK_ROW_H - 4) * stageScale,
      fontSize: LABEL_FONT * stageScale,
      onCommit: (v) => updateTaskLabel(featureId, group.id, taskId, v),
    });
  }

  function handleAddTask() {
    const taskId = addTask(featureId, group.id, "");
    const taskIndex = useEstimationsStore.getState().features
      .find((f) => f.id === featureId)?.groups
      .find((g) => g.id === group.id)?.tasks.length ?? 0;
    const taskY = GROUP_HEADER_H + (taskIndex - 1) * TASK_ROW_H;

    requestTextEdit({
      value: "",
      x: layout.x * stageScale + PAD,
      y: (layout.y + taskY) * stageScale + 2,
      width: (layout.width - PAD * 2) * stageScale,
      height: (TASK_ROW_H - 4) * stageScale,
      fontSize: LABEL_FONT * stageScale,
      onCommit: (v) => {
        if (v.trim()) {
          updateTaskLabel(featureId, group.id, taskId, v.trim());
        }
      },
    });
  }

  // Darken the color slightly for the header
  const headerColor = darken(group.color, 0.15);

  return (
    <Group x={layout.x} y={layout.y}>
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
            {/* Row highlight when selected */}
            {isSelected && (
              <Rect
                width={layout.width}
                height={TASK_ROW_H}
                fill="rgba(255,255,255,0.5)"
              />
            )}
            {/* Subtle divider */}
            <Rect y={0} width={layout.width} height={1} fill="rgba(0,0,0,0.06)" />
            {/* Label */}
            <Text
              x={PAD}
              y={(TASK_ROW_H - LABEL_FONT) / 2}
              width={layout.width - PAD * 2 - 44}
              text={task.label || "Double-click to label…"}
              fontSize={LABEL_FONT}
              fill={task.label ? "#1f2937" : "#9ca3af"}
              ellipsis
            />
            {/* Estimate — right-aligned */}
            <Text
              x={layout.width - 44}
              y={(TASK_ROW_H - EST_FONT) / 2}
              width={38}
              text={estText}
              fontSize={EST_FONT}
              fontStyle="italic"
              fill="#374151"
              align="right"
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

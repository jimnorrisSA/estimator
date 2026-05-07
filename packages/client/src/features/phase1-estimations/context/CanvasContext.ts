import { createContext, useContext } from "react";
import type Konva from "konva";
import type { EstimateUnit } from "@estimator/shared";

export interface TextEditRequest {
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  onCommit: (next: string) => void;
}

export interface EstimateEditRequest {
  value: number;
  unit: EstimateUnit;
  x: number;
  y: number;
  onCommit: (value: number, unit: EstimateUnit) => void;
}

export interface DisciplinePickRequest {
  x: number;
  y: number;
  featureId: string;
}

export interface ConfirmRequest {
  message: string;
  onConfirm: () => void;
}

export interface CanvasContextValue {
  registerNode: (id: string, node: Konva.Node) => void;
  unregisterNode: (id: string) => void;
  requestTextEdit: (req: TextEditRequest) => void;
  requestEstimateEdit: (req: EstimateEditRequest) => void;
  requestDisciplinePick: (req: DisciplinePickRequest) => void;
  requestConfirm: (req: ConfirmRequest) => void;
}

export const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvasContext() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvasContext must be used inside EstimationCanvas");
  return ctx;
}

import { createContext, useContext } from "react";
import type Konva from "konva";

export interface TextEditRequest {
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  onCommit: (next: string) => void;
}

export interface CanvasContextValue {
  registerNode: (id: string, node: Konva.Node) => void;
  unregisterNode: (id: string) => void;
  requestTextEdit: (req: TextEditRequest) => void;
}

export const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvasContext() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvasContext must be used inside EstimationCanvas");
  return ctx;
}

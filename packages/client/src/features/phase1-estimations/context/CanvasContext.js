import { createContext, useContext } from "react";
export const CanvasContext = createContext(null);
export function useCanvasContext() {
    const ctx = useContext(CanvasContext);
    if (!ctx)
        throw new Error("useCanvasContext must be used inside EstimationCanvas");
    return ctx;
}

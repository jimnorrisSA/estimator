import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { EstimationList } from "./EstimationList.js";
import { EstimationCanvas } from "./components/EstimationCanvas.js";
import { useEstimationsStore } from "./store/estimationsStore.js";
export function EstimationsPage() {
    const undo = useEstimationsStore((s) => s.undo);
    const redo = useEstimationsStore((s) => s.redo);
    useEffect(() => {
        function onKeyDown(e) {
            const target = e.target;
            // Don't intercept when typing in an input or textarea
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
                return;
            if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if ((e.key === "y" && (e.ctrlKey || e.metaKey)) ||
                (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
                e.preventDefault();
                redo();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [undo, redo]);
    return (_jsxs("div", { className: "flex h-full w-full", children: [_jsx(EstimationList, {}), _jsx(EstimationCanvas, {})] }));
}

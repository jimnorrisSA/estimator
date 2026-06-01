import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
const UNITS = [
    { unit: "half_day", label: "½d" },
    { unit: "day", label: "d" },
    { unit: "week", label: "w" },
    { unit: "month", label: "mo" },
];
export function EstimateOverlay({ edit, onDone }) {
    const inputRef = useRef(null);
    const [value, setValue] = useState(String(edit.value));
    const [unit, setUnit] = useState(edit.unit);
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    function commit() {
        const n = parseFloat(value);
        if (!isNaN(n) && n > 0)
            edit.onCommit(n, unit);
        onDone();
    }
    function onKeyDown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            commit();
        }
        if (e.key === "Escape")
            onDone();
    }
    const OVERLAY_W = 168;
    return (_jsx(motion.div, { style: {
            position: "fixed",
            left: edit.x - OVERLAY_W,
            top: edit.y - 4,
            zIndex: 1001,
            transformOrigin: "right center",
        }, initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] }, onMouseDown: (e) => e.stopPropagation(), children: _jsxs("div", { className: "flex items-center gap-1 bg-[#1d1930] border-2 border-[#7c3aed] rounded-lg shadow-xl px-2 py-1", style: { width: OVERLAY_W }, children: [_jsx("input", { ref: inputRef, type: "number", min: 0.5, step: 0.5, value: value, onChange: (e) => setValue(e.target.value), onKeyDown: onKeyDown, onBlur: commit, className: "w-12 text-right text-sm font-mono border-none outline-none bg-transparent text-[#ece7ff]" }), _jsx("div", { className: "flex gap-0.5", children: UNITS.map(({ unit: u, label }) => (_jsx("button", { type: "button", onMouseDown: (e) => { e.preventDefault(); setUnit(u); }, className: `px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${unit === u
                            ? "bg-[#7c3aed] text-white"
                            : "bg-[#252041] text-[#9b93ba] hover:bg-[#2e2848]"}`, children: label }, u))) })] }) }));
}

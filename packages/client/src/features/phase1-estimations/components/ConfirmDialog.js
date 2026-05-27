import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { motion } from "motion/react";
export function ConfirmDialog({ req, onDone }) {
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape")
                onDone();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onDone]);
    return (_jsx(motion.div, { className: "fixed inset-0 z-[2000] flex items-center justify-center", style: { backgroundColor: "rgba(0,0,0,0.6)" }, initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 }, onMouseDown: onDone, children: _jsxs(motion.div, { className: "bg-[#1d1930] border border-[#2e2848] rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4", initial: { scale: 0.94, opacity: 0, y: 6 }, animate: { scale: 1, opacity: 1, y: 0 }, transition: { type: "spring", duration: 0.3, bounce: 0.15 }, onMouseDown: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("p", { className: "text-sm font-semibold text-[#ece7ff]", children: "Are you sure?" }), _jsx("p", { className: "text-sm text-[#9b93ba]", children: req.message })] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "px-4 py-1.5 text-sm rounded-lg border border-[#2e2848] text-[#9b93ba] hover:bg-[#252041] transition-colors", onClick: onDone, children: "Cancel" }), _jsx("button", { className: "px-4 py-1.5 text-sm rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium transition-colors", onClick: () => {
                                req.onConfirm();
                                onDone();
                            }, children: "Delete" })] })] }) }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
export function ConfirmDialog({ req, onDone }) {
    // Close on Escape
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape")
                onDone();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onDone]);
    return (
    /* Backdrop */
    _jsx("div", { className: "fixed inset-0 z-[2000] flex items-center justify-center bg-black/30", onMouseDown: onDone, children: _jsxs("div", { className: "bg-white rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4", onMouseDown: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("p", { className: "text-sm font-semibold text-gray-900", children: "Are you sure?" }), _jsx("p", { className: "text-sm text-gray-500", children: req.message })] }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "px-4 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors", onClick: onDone, children: "Cancel" }), _jsx("button", { className: "px-4 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors", onClick: () => {
                                req.onConfirm();
                                onDone();
                            }, children: "Delete" })] })] }) }));
}

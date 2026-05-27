import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
export function TaskEditModal({ task, resources, onSave, onUnpin, onClose }) {
    const [label, setLabel] = useState(task.label);
    const [estimateValue, setEstimateValue] = useState(String(task.estimateValue));
    const [estimateUnit, setEstimateUnit] = useState(task.estimateUnit);
    const [assignedResourceId, setAssignedResourceId] = useState(task.assignedResourceId ?? "");
    const [notes, setNotes] = useState(task.notes);
    const labelRef = useRef(null);
    useEffect(() => {
        labelRef.current?.focus();
        labelRef.current?.select();
    }, []);
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === "Escape")
                onClose();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);
    const disciplineResources = resources.filter((r) => r.role === task.discipline);
    function handleSave() {
        const parsedValue = parseFloat(estimateValue);
        onSave({
            label: label.trim() || task.label,
            estimateValue: isNaN(parsedValue) || parsedValue <= 0 ? task.estimateValue : parsedValue,
            estimateUnit,
            assignedResourceId: assignedResourceId || null,
            notes,
        });
        onClose();
    }
    return (_jsx(motion.div, { className: "fixed inset-0 z-[2000] flex items-center justify-center backdrop-blur-sm", style: { backgroundColor: "rgba(0,0,0,0.6)" }, initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 }, onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs(motion.div, { className: "bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl w-[420px] max-w-[90vw] p-5", initial: { scale: 0.94, opacity: 0, y: 8 }, animate: { scale: 1, opacity: 1, y: 0 }, transition: { type: "spring", duration: 0.3, bounce: 0.15 }, children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-xs text-[#5c5575] mb-0.5", children: [task.featureName, " \u00B7 ", task.discipline] }), _jsx("h2", { className: "text-base font-semibold text-[#e2ddf5]", children: "Edit Task" })] }), _jsx("button", { onClick: onClose, className: "text-[#5c5575] hover:text-[#9b93ba] text-xl leading-none mt-0.5", children: "\u00D7" })] }), _jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[#5c5575] mb-1", children: "Task name" }), _jsx("input", { ref: labelRef, type: "text", value: label, onChange: (e) => setLabel(e.target.value), onKeyDown: (e) => { if (e.key === "Enter")
                                        handleSave(); }, className: "w-full bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[#5c5575] mb-1", children: "Estimate" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "number", min: 0.5, step: 0.5, value: estimateValue, onChange: (e) => setEstimateValue(e.target.value), className: "w-24 bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors" }), _jsxs("select", { value: estimateUnit, onChange: (e) => setEstimateUnit(e.target.value), className: "flex-1 bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors", children: [_jsx("option", { value: "half_day", children: "Half day" }), _jsx("option", { value: "day", children: "Day" }), _jsx("option", { value: "week", children: "Week" }), _jsx("option", { value: "month", children: "Month" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[#5c5575] mb-1", children: "Assigned to" }), _jsxs("select", { value: assignedResourceId, onChange: (e) => setAssignedResourceId(e.target.value), className: "w-full bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors", children: [_jsx("option", { value: "", children: "Unassigned" }), disciplineResources.length === 0 && task.assignedResourceId && (_jsx("option", { value: task.assignedResourceId, disabled: true, children: "(resource removed)" })), disciplineResources.map((r) => (_jsx("option", { value: r.id, children: r.name }, r.id)))] }), disciplineResources.length === 0 && (_jsxs("p", { className: "text-xs text-[#5c5575] mt-1", children: ["No ", task.discipline, " team members \u2014 add them in the Team panel."] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[#5c5575] mb-1", children: "Notes" }), _jsx("textarea", { rows: 2, value: notes, onChange: (e) => setNotes(e.target.value), className: "w-full bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors resize-none" })] })] }), _jsxs("div", { className: "flex items-center justify-between mt-4 pt-4 border-t border-[#2e2848]", children: [_jsx("div", { children: task.isPinned && (_jsx("button", { onClick: () => { onUnpin(); onClose(); }, className: "text-xs text-[#5c5575] hover:text-[#9b93ba] underline underline-offset-2 transition-colors", children: "Unpin task" })) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: onClose, className: "px-3 py-1.5 text-sm text-[#5c5575] hover:text-[#9b93ba] rounded-lg transition-colors", children: "Cancel" }), _jsx("button", { onClick: handleSave, className: "px-4 py-1.5 text-sm font-medium bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg transition-colors", children: "Save" })] })] })] }) }));
}

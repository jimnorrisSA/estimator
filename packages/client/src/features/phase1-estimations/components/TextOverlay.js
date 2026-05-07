import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
export function TextOverlay({ edit, onDone }) {
    const ref = useRef(null);
    useEffect(() => {
        const ta = ref.current;
        if (!ta)
            return;
        ta.focus();
        ta.select();
    }, []);
    function commit() {
        if (!ref.current)
            return;
        edit.onCommit(ref.current.value);
        onDone();
    }
    function onKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
        }
        if (e.key === "Escape") {
            onDone();
        }
    }
    return (_jsx("textarea", { ref: ref, defaultValue: edit.value, onBlur: commit, onKeyDown: onKeyDown, style: {
            position: "fixed",
            left: edit.x,
            top: edit.y,
            width: edit.width,
            height: edit.height,
            fontSize: edit.fontSize,
            fontFamily: "inherit",
            padding: "4px",
            border: "2px solid #7c3aed",
            borderRadius: "4px",
            resize: "none",
            background: "#1d1930",
            color: "#ece7ff",
            zIndex: 1000,
            outline: "none",
            lineHeight: 1.4,
        } }));
}

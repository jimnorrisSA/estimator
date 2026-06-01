import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";
// ── Helpers ───────────────────────────────────────────────────────────────────
function safeFilename(name, suffix, ext) {
    const base = name.replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").toLowerCase() || "project";
    return `${base}_${suffix}.${ext}`;
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
}
// ── PNG ───────────────────────────────────────────────────────────────────────
export function exportTimelinePng(projectName) {
    const labelSvg = document.querySelector("[data-label-svg]");
    const chartSvg = document.querySelector("[data-chart-svg]");
    if (!labelSvg || !chartSvg)
        return;
    const lW = parseFloat(labelSvg.getAttribute("width") ?? "124");
    const cW = parseFloat(chartSvg.getAttribute("width") ?? "800");
    const svgH = parseFloat(labelSvg.getAttribute("height") ?? "400");
    const totalW = lW + cW;
    const svgStr = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${svgH}">`,
        `<rect width="${totalW}" height="${svgH}" fill="#14112a"/>`,
        `<g>${labelSvg.innerHTML}</g>`,
        `<g transform="translate(${lW},0)">${chartSvg.innerHTML}</g>`,
        `</svg>`,
    ].join("");
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = totalW * scale;
        canvas.height = svgH * scale;
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);
        ctx.fillStyle = "#14112a";
        ctx.fillRect(0, 0, totalW, svgH);
        ctx.drawImage(img, 0, 0, totalW, svgH);
        URL.revokeObjectURL(url);
        canvas.toBlob((pngBlob) => {
            if (pngBlob)
                downloadBlob(pngBlob, safeFilename(projectName, "timeline", "png"));
        });
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
}
// ── CSV ───────────────────────────────────────────────────────────────────────
export function exportCsv(tasks, settings) {
    const sym = CURRENCY_SYMBOLS[settings.currency];
    const rows = [
        ["Feature", "Task", "Discipline", "Estimate", "Working Days", "Start Day", "End Day", "Cost", "Notes"],
        ...tasks.map((t) => [
            t.featureName,
            t.label,
            t.discipline,
            `${t.estimateValue} ${t.estimateUnit}`,
            String(t.workingDays),
            String(t.startDay + 1),
            String(t.endDay),
            t.cost > 0 ? `${sym}${Math.round(t.cost)}` : "",
            t.notes,
        ]),
    ];
    const csv = rows
        .map((row) => row.map((cell) => {
        const s = String(cell);
        return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    }).join(","))
        .join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), safeFilename(settings.projectName, "schedule", "csv"));
}
// ── JSON ──────────────────────────────────────────────────────────────────────
export function exportJson(data, projectName) {
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), safeFilename(projectName, "schedule", "json"));
}
// ── PDF ───────────────────────────────────────────────────────────────────────
export async function exportPdf(tasks, settings, result) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
    ]);
    const sym = CURRENCY_SYMBOLS[settings.currency];
    const baseCost = tasks.reduce((s, t) => s + t.cost, 0);
    const totalCost = baseCost * (1 + settings.contingencyPct / 100);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(20);
    doc.setTextColor(44, 30, 70);
    doc.text(settings.projectName, 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(120, 100, 160);
    const parts = [
        `${result.totalDays} working days`,
        `+${result.contingencyDays}d contingency (${settings.contingencyPct}%)`,
        `${tasks.length} tasks`,
        ...(baseCost > 0 ? [`Total ${sym}${Math.round(totalCost).toLocaleString()}`] : []),
    ];
    doc.text(parts.join("   ·   "), 14, 23);
    autoTable(doc, {
        startY: 28,
        head: [["Feature", "Task", "Discipline", "Estimate", "Days", "Start", "End", "Cost", "Notes"]],
        body: tasks.map((t) => [
            t.featureName,
            t.label || "–",
            t.discipline,
            `${t.estimateValue} ${t.estimateUnit.replace("_", " ")}`,
            t.workingDays,
            t.startDay + 1,
            t.endDay,
            t.cost > 0 ? `${sym}${Math.round(t.cost).toLocaleString()}` : "–",
            t.notes || "",
        ]),
        styles: { fontSize: 8, cellPadding: 2, textColor: [40, 30, 60] },
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 246, 255] },
        columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 48 },
            2: { cellWidth: 22 },
            3: { cellWidth: 22 },
            4: { cellWidth: 12 },
            5: { cellWidth: 12 },
            6: { cellWidth: 12 },
            7: { cellWidth: 22 },
            8: { cellWidth: "auto" },
        },
        margin: { left: 14, right: 14 },
    });
    doc.save(safeFilename(settings.projectName, "schedule", "pdf"));
}
// ── Word (.docx) ──────────────────────────────────────────────────────────────
export async function exportDocx(tasks, settings, result) {
    const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel, ShadingType, } = await import("docx");
    const sym = CURRENCY_SYMBOLS[settings.currency];
    const baseCost = tasks.reduce((s, t) => s + t.cost, 0);
    const totalCost = baseCost * (1 + settings.contingencyPct / 100);
    const COLS = ["Feature", "Task", "Discipline", "Estimate", "Days", "Start", "End", "Cost", "Notes"];
    const headerRow = new TableRow({
        tableHeader: true,
        children: COLS.map((h) => new TableCell({
            children: [
                new Paragraph({
                    children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })],
                }),
            ],
            shading: { type: ShadingType.CLEAR, fill: "7C3AED", color: "auto" },
        })),
    });
    const dataRows = tasks.map((t, i) => new TableRow({
        children: [
            t.featureName,
            t.label || "–",
            t.discipline,
            `${t.estimateValue} ${t.estimateUnit.replace("_", " ")}`,
            String(t.workingDays),
            String(t.startDay + 1),
            String(t.endDay),
            t.cost > 0 ? `${sym}${Math.round(t.cost).toLocaleString()}` : "–",
            t.notes || "",
        ].map((text) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
            shading: {
                type: ShadingType.CLEAR,
                fill: i % 2 === 0 ? "F5F3FF" : "FFFFFF",
                color: "auto",
            },
        })),
    }));
    const statsLine = [
        `${result.totalDays} working days`,
        `+${result.contingencyDays} days contingency (${settings.contingencyPct}%)`,
        `${tasks.length} tasks`,
        ...(baseCost > 0 ? [`Total ${sym}${Math.round(totalCost).toLocaleString()}`] : []),
    ].join("   ·   ");
    const doc = new Document({
        sections: [
            {
                children: [
                    new Paragraph({
                        heading: HeadingLevel.HEADING_1,
                        children: [new TextRun({ text: settings.projectName, bold: true })],
                        spacing: { after: 120 },
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: statsLine, color: "786AA0", size: 18 })],
                        spacing: { after: 280 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            },
        ],
    });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, safeFilename(settings.projectName, "schedule", "docx"));
}

"use client";

// Sidebar form for the active Report CTA widget. The widget itself also
// has its own inline editor (in TiptapEditor.js) — this form just gives
// authors a second affordance from the panel when a widget is selected.
export default function ReportCtaForm({ widget, update }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Eyebrow badge</div>
        <input
          type="text"
          value={widget.reportEyebrow || ""}
          onChange={(e) => update({ reportEyebrow: e.target.value })}
          placeholder="New Report"
        />
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Report title</div>
        <input
          type="text"
          value={widget.reportTitle || ""}
          onChange={(e) => update({ reportTitle: e.target.value })}
          placeholder="Agentic AI in India's Growth 2026"
        />
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Tagline</div>
        <textarea
          value={widget.reportTagline || ""}
          onChange={(e) => update({ reportTagline: e.target.value })}
          placeholder="Download the report"
          style={{ minHeight: 44, resize: "vertical" }}
        />
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Button label</div>
        <input
          type="text"
          value={widget.reportCtaLabel || ""}
          onChange={(e) => update({ reportCtaLabel: e.target.value })}
          placeholder="Download Report"
        />
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Report URL</div>
        <input
          type="text"
          value={widget.reportUrl || ""}
          onChange={(e) => update({ reportUrl: e.target.value })}
          placeholder="/free-resources"
        />
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Accent color</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="color"
            value={widget.reportAccent || "#7c3aed"}
            onChange={(e) => update({ reportAccent: e.target.value })}
            style={{ width: 40, height: 32, padding: 0, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "transparent" }}
          />
          <input
            type="text"
            value={widget.reportAccent || "#7c3aed"}
            onChange={(e) => update({ reportAccent: e.target.value })}
            placeholder="#7c3aed"
            style={{ flex: 1, fontFamily: "monospace" }}
          />
        </div>
      </div>
    </div>
  );
}

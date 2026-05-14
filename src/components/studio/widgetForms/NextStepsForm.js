"use client";

const MAX_STEPS = 6;

export default function NextStepsForm({ widget, update }) {
  const steps = widget.steps || ["", "", ""];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="f-lbl" style={{ marginBottom: 2 }}>Steps</div>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", width: 16, flexShrink: 0, textAlign: "right" }}>
            {i + 1}.
          </span>
          <input
            type="text"
            value={step}
            onChange={(e) => {
              const next = [...steps];
              next[i] = e.target.value;
              update({ steps: next });
            }}
            placeholder={`Step ${i + 1}…`}
            style={{ flex: 1 }}
          />
          {steps.length > 1 && (
            <button
              onClick={() => update({ steps: steps.filter((_, j) => j !== i) })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text4)", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
            >×</button>
          )}
        </div>
      ))}
      {steps.length < MAX_STEPS && (
        <button
          onClick={() => update({ steps: [...steps, ""] })}
          style={{ fontSize: 12, color: "var(--text3)", background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", marginTop: 2 }}
        >+ Add step</button>
      )}
    </div>
  );
}

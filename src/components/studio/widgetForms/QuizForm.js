"use client";

export default function QuizForm({ widget, update }) {
  const opts = widget.options || ["", "", "", ""];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Question</div>
        <textarea
          value={widget.question || ""}
          onChange={(e) => update({ question: e.target.value })}
          placeholder="Enter your quiz question…"
          style={{ minHeight: 52, resize: "vertical" }}
        />
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>
          Options <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}>click ✓ to mark correct</span>
        </div>
        {opts.map((opt, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <button
              onClick={() => update({ correctIndex: i })}
              style={{
                width: 22, height: 22, borderRadius: "50%",
                border: `2px solid ${widget.correctIndex === i ? "#16a34a" : "var(--border)"}`,
                background: widget.correctIndex === i ? "#16a34a" : "var(--bg)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 11, flexShrink: 0, fontWeight: 700,
              }}
            >
              {widget.correctIndex === i ? "✓" : ""}
            </button>
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const next = [...opts];
                next[i] = e.target.value;
                update({ options: next });
              }}
              placeholder={`Option ${i + 1}`}
              style={{ flex: 1 }}
            />
          </div>
        ))}
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>
          Explanation <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}>shown after answering</span>
        </div>
        <textarea
          value={widget.explanation || ""}
          onChange={(e) => update({ explanation: e.target.value })}
          placeholder="Brief explanation of the correct answer…"
          style={{ minHeight: 44, resize: "vertical" }}
        />
      </div>
    </div>
  );
}

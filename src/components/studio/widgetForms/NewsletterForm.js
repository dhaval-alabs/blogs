"use client";

export default function NewsletterForm({ widget, update }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Headline</div>
        <input
          type="text"
          value={widget.headline || ""}
          onChange={(e) => update({ headline: e.target.value })}
          placeholder="Get the Data Science Career Guide"
        />
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Subtext</div>
        <textarea
          value={widget.subtext || ""}
          onChange={(e) => update({ subtext: e.target.value })}
          placeholder="Join 40,000+ learners…"
          style={{ minHeight: 44, resize: "vertical" }}
        />
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Button label</div>
        <input
          type="text"
          value={widget.ctaLabel || ""}
          onChange={(e) => update({ ctaLabel: e.target.value })}
          placeholder="Subscribe →"
        />
      </div>
    </div>
  );
}

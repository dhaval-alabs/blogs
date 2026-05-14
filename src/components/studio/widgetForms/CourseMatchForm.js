"use client";

export default function CourseMatchForm({ widget, update, context }) {
  const studioCourses = context?.studioCourses || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>Course</div>
        <select
          value={widget.courseId || ""}
          onChange={(e) => update({ courseId: e.target.value || null })}
        >
          <option value="">— Auto-match by domain tags —</option>
          {studioCourses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="f-lbl" style={{ marginBottom: 5 }}>CTA headline</div>
        <input
          type="text"
          value={widget.ctaHeadline || ""}
          onChange={(e) => update({ ctaHeadline: e.target.value })}
          placeholder="Ready to go deeper? Enroll now →"
        />
      </div>
    </div>
  );
}

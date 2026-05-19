/**
 * Client-safe data — static author profiles, courses, salary computation.
 *
 * This file is safe to import from "use client" components.
 * For Supabase-backed post queries, use data.server.js instead.
 */

// ── Authors ───────────────────────────────────────────────────────
export const authors = {
  "al-editorial": {
    slug: "al-editorial",
    name: "AnalytixLabs Editorial",
    initials: "AL",
    color: "bg-primary",
    bio: "The AnalytixLabs internal writing team, curating the best in data science education.",
    linkedin: "https://linkedin.com/company/analytixlabs",
    expertise: ["Data Science Education", "Career Advice"],
    experience: "12 Years",
    image: "/authorlogo.png",
  },
};

// ── Courses ───────────────────────────────────────────────────────
export const courses = [
  {
    id: "ds-spec",
    title: "Data Science Specialization",
    label: "Specialization",
    domain_tags: ["Statistics", "Python", "Machine Learning"],
    desc: "Master Python, SQL, and predictive modeling with real-world industry capstones.",
    duration: "6 months",
    rating: 4.8,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCh8ivFg8VBjm2zpSqFnI-3MkdXemZRSmKL2fjdyxcBS8zcU2-UO7L4MgVMkbcKU7QeMp3AqnZyLnQMcFIVIDy-nOePtrXzxxBb-dIcantQaJlGrtdaim5JYD9yWkTTplcGh1YMilpDaNpYC3dURy4WxcN0XHtCOyLrIOITJbAnk1suzP0SV1aXc6H3_N4wxno_E7HfrPo399y67upgN34RsH2sZgD2ZRpy-IB5AiUXzj8CXMgxrqdKopbcQjvx_VNVXcXoInX2wlSG",
  },
  {
    id: "ml-mastery",
    title: "Machine Learning Mastery",
    label: "Advanced",
    domain_tags: ["Deep Learning", "Generative AI", "PyTorch"],
    desc: "Deep dive into neural networks, reinforcement learning, and advanced algorithms.",
    duration: "4 months",
    rating: 4.7,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwHYUYKnycf2FxVMoMCwQ1UgZgFyXDw8j_lUAbdLeOtbVyqvKgCAj_9A4FbNSI_SCYRy9wt--t0aRl_dUOO9YxKorbLZ4y6AxJFXAkA3CcgxkLwIOAXVLnNgvbeI7RaERrw0KGpDug9OZVgDwzno0OEQ6TrcqtPAgu_sHsjWmEwHiCaJtigft21XzPpMDMA8xuf2W5vW-g-36ROGFSPY7HTTEaRHDv93wFbGeaUkAS_p5GOysPBVryKY1hp_pFwOBRVP2Fwbe3Y41X",
  },
  {
    id: "ai-eng",
    title: "AI Engineering",
    label: "Engineering",
    domain_tags: ["MLOps", "Data Engineering", "Generative AI"],
    desc: "Build and deploy large-scale AI applications using modern RAG and LLM stacks.",
    duration: "5 months",
    rating: 4.9,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCRG-_Ndw0YrduOsgmsEJX_Jm6TR75Ghzm5RN42hzi5WzxAtIWIMEmQWKMhxdA2yLswwhqDOOt5qWJvLsRRcZ1KFCxAWb7559VQIkaC5hFUjsKiQ_lq33vk-a-nRYYkIoXe30BuU8B6HIhXbsgE7eUNcrpzEvnl4QHQNSUYsY-tn5MvhnDXDVwQKmYyw_YWkOVOO5RSEpGsI0zdiNdkAOlNxZERYHt34IrTHdrZc7QKenh9t4Yxcx3Kvkxbht8V-qBJqfwXHIYWftur",
  },
];

// ── Salary Data ───────────────────────────────────────────────────
// Fallback table used only when the Gemini-backed `/api/salary` endpoint
// is unavailable. The canonical numbers come from the salary_estimates
// table, refreshed weekly via Gemini with Google Search grounding.

// Canonical option lists — keep these in sync with isValidParams() in
// salary-estimator.server.js.
export const ROLES = [
  "Data Scientist",
  "Data Engineer",
  "AI Engineer / ML Engineer",
  "Data Analyst",
  "Business Analyst",
  "BI Analyst",
  "MLOps Engineer",
  "AI Research Scientist",
  "Computer Vision Engineer",
  "NLP Engineer",
  "Generative AI / LLM Engineer",
  "Analytics Manager",
];

export const LOCATIONS = [
  "Bangalore",
  "Delhi NCR",
  "Mumbai",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Remote",
];

export const EXPERIENCES = ["0-2", "3-5", "6-10", "10+"];

// Base medians (LPA) per role at the Bangalore baseline, with location
// multipliers and experience multipliers applied on top. Used only as
// a fallback when Gemini is unreachable.
const BASE_LPA = {
  "Data Scientist":              12,
  "Data Engineer":               11,
  "AI Engineer / ML Engineer":   14,
  "Data Analyst":                7,
  "Business Analyst":            8,
  "BI Analyst":                  7.5,
  "MLOps Engineer":              13,
  "AI Research Scientist":       18,
  "Computer Vision Engineer":    13,
  "NLP Engineer":                13.5,
  "Generative AI / LLM Engineer": 16,
  "Analytics Manager":           20,
};

const LOCATION_MULT = {
  Bangalore:   1.00,
  "Delhi NCR": 0.88,
  Mumbai:      0.93,
  Hyderabad:   0.90,
  Pune:        0.87,
  Chennai:     0.85,
  Remote:      0.95,
};

const EXP_MULT = { "0-2": 1.0, "3-5": 1.5, "6-10": 2.2, "10+": 3.5 };

// Backwards-compatible export — anything still importing salaryData
// gets a generated object instead of the old hand-tuned matrix.
export const salaryData = ROLES.reduce((acc, role) => {
  const base = BASE_LPA[role] || 10;
  acc[role] = {
    base: Object.fromEntries(LOCATIONS.map((loc) => [loc, +(base * (LOCATION_MULT[loc] || 1)).toFixed(1)])),
    multiplier: { ...EXP_MULT },
  };
  return acc;
}, {});

// ── Salary helpers ────────────────────────────────────────────────
export const getRoles       = () => ROLES;
export const getLocations   = () => LOCATIONS;
export const getExperiences = () => EXPERIENCES;

export function getSalaryRange(role, location, experience) {
  const base = BASE_LPA[role];
  if (!base) return { min: 0, max: 0, median: 0 };
  const locMult = LOCATION_MULT[location] || 1.0;
  const expMult = EXP_MULT[experience] || 1.0;
  const rawBase = base * locMult * expMult;
  return {
    min:    (rawBase * 0.85).toFixed(1),
    max:    (rawBase * 1.25).toFixed(1),
    median: rawBase.toFixed(1),
  };
}

// ── Course matcher (overlap-based) ────────────────────────────────
function getOverlap(arr1, arr2) {
  if (!arr1 || !arr2) return 0;
  return arr1.filter((item) => arr2.includes(item)).length;
}

export function getCourseMatch(tags) {
  if (!tags || tags.length === 0) return courses[0];
  let best = courses[0];
  let high = -1;
  for (const c of courses) {
    const score = getOverlap(c.domain_tags, tags);
    if (score > high) { high = score; best = c; }
  }
  return best;
}

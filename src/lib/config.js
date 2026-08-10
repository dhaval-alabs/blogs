/**
 * Site-wide configuration — single source of truth.
 *
 * Import from here instead of hardcoding strings/arrays in pages.
 * All constants are grouped by feature area.
 */

// ── Branding & SEO ────────────────────────────────────────────────
export const SITE_NAME        = "AnalytixLabs Editorial";
export const SITE_TAGLINE     = "Data Science & AI Insights";
export const SITE_DESCRIPTION = "Deep, authoritative insights into Data Science, Machine Learning, AI, and Analytics from industry experts at AnalytixLabs.";
export const COPYRIGHT_YEAR   = new Date().getFullYear();

// ── Navigation ────────────────────────────────────────────────────
export const NAV_CATEGORIES = [
  { label: "Salary Hub",        href: "/salary-hub" },
];

export const MOBILE_NAV_ITEMS = [
  { id: "home",     icon: "home",     label: "Home",     href: "/blog" },
  { id: "courses",  icon: "school",   label: "Courses",  href: "https://www.analytixlabs.co.in/courses/" },
];

export const FOOTER_DATA = {
  popularSearches: [
    { label: "Data Analyst Training Course In Delhi", href: "https://www.analytixlabs.co.in/data-analyst-training-course-in-delhi/" },
    { label: "Data Analyst Training Course In Noida", href: "https://www.analytixlabs.co.in/data-analyst-training-course-in-noida/" },
    { label: "Data Analyst Training Course In Gurgaon", href: "https://www.analytixlabs.co.in/data-analyst-training-course-in-gurgaon/" },
    { label: "Data Analyst Training Course In Bangalore", href: "https://www.analytixlabs.co.in/data-analyst-training-course-in-bangalore/" },
    { label: "Data Science Course in Delhi", href: "https://www.analytixlabs.co.in/data-science-course-in-delhi/" },
    { label: "Data Science Course In Noida", href: "https://www.analytixlabs.co.in/data-science-course-in-noida/" },
    { label: "Data Science Course In Gurgaon", href: "https://www.analytixlabs.co.in/data-science-course-in-gurgaon/" },
    { label: "Data Science Course In Bangalore", href: "https://www.analytixlabs.co.in/data-science-course-training-bangalore/" },
    { label: "Business Analyst Course In Bangalore", href: "https://www.analytixlabs.co.in/business-analyst-course-in-bangalore/" },
    { label: "Business Analyst Course In Delhi", href: "https://www.analytixlabs.co.in/business-analyst-course-in-delhi/" },
    { label: "Artificial Intelligence Course in Bangalore", href: "https://www.analytixlabs.co.in/artificial-intelligence-course-in-bangalore/" },
    { label: "Artificial Intelligence Course in Delhi", href: "https://www.analytixlabs.co.in/artificial-intelligence-course-in-delhi/" },
    { label: "Artificial Intelligence for Managers Leaders", href: "https://www.analytixlabs.co.in/artificial-intelligence-for-managers-leaders/" },
    { label: "Generative AI Course", href: "https://www.analytixlabs.co.in/generative-ai-course/" },
  ],
  about: [
    { label: "Why Us", href: "https://www.analytixlabs.co.in/why-us/" },
    { label: "Courses", href: "https://www.analytixlabs.co.in/courses/" },
    { label: "About Faculty", href: "https://www.analytixlabs.co.in/about-faculty/" },
    { label: "Contact Us", href: "https://www.analytixlabs.co.in/contact-us/" },
    { label: "AnalytixLabs Placements", href: "https://www.analytixlabs.co.in/placements/" },
    { label: "System Requirements", href: "https://www.analytixlabs.co.in/system-requirements/" },
  ],
  etcetera: [
    { label: "Enterprises", href: "https://www.analytixlabs.co.in/enterprises/" },
    { label: "Free Resources", href: "https://www.analytixlabs.co.in/free-resources/" },
    { label: "Success Stories", href: "https://www.analytixlabs.co.in/reviews-complaints-testimonials/" },
    { label: "Colleges Universities Training Courses", href: "https://www.analytixlabs.co.in/colleges-universities-training-courses/" },
  ],
  socials: [
    { platform: "Instagram", href: "https://instagram.com/analytixlabs?igshid=5outdkxzn8xq" },
    { platform: "Facebook", href: "https://www.facebook.com/analytixlabs" },
    { platform: "Youtube", href: "https://www.youtube.com/@analytixlabs./videos" },
    { platform: "Linkedin", href: "https://www.linkedin.com/company/analytixlabs/" },
    { platform: "X", href: "https://twitter.com/AnalytixLabs" },
    { platform: "Medium", href: "https://medium.com/@byanalytixlabs" },
  ],
  legal: [
    { label: "Privacy Policy", href: "https://www.analytixlabs.co.in/privacy/" },
    { label: "Terms and Conditions", href: "https://www.analytixlabs.co.in/terms-conditions/" },
    { label: "Sitemap", href: "https://www.analytixlabs.co.in/sitemap_index.xml" },
  ]
};

// ── Filtering ─────────────────────────────────────────────────────
export const SKILL_LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];

// Fallback only, shown until FilterBar's /api/topics fetch resolves (or if it
// fails/returns empty) — the real, editable list lives in Studio → Topics.
export const TOPIC_OPTIONS = [
  "Data Science",
  "Machine Learning",
  "Deep Learning",
  "AI Engineering",
  "Analytics",
  "Career Growth",
];

// ── Sidebar Salary Widget ─────────────────────────────────────────
// Offline fallback rows. Used only when /api/salary/preview is unreachable.
export const SALARY_PREVIEW_ROWS = [
  { role: "Data Scientist", range: "₹18–28 LPA", meta: "Bangalore · 3-5 yrs", badge: null },
  { role: "ML Engineer",    range: "₹18–28 LPA", meta: "Mumbai · 2-4 yrs",    badge: null },
  { role: "Data Analyst",   range: "₹10–20 LPA", meta: "Delhi NCR · 0-3 yrs", badge: null },
  { role: "AI Researcher",  range: "₹18–28 LPA", meta: "Pan India · 6+ yrs",  badge: "New" },
];

// Pool the sidebar widget rotates through. Each ISO week, 4 contiguous
// entries (mod length) are selected — pool of 16 means a full cycle every
// 4 weeks. `role/location/experience` must match the canonical ROLES,
// LOCATIONS, EXPERIENCES lists in lib/data.js. `display` is the short
// label shown in the card.
export const SALARY_PREVIEW_POOL = [
  { role: "Data Scientist",                location: "Bangalore",  experience: "3-5",  display: "Data Scientist" },
  { role: "Data Engineer",                 location: "Bangalore",  experience: "3-5",  display: "Data Engineer" },
  { role: "AI Engineer / ML Engineer",     location: "Bangalore",  experience: "3-5",  display: "ML Engineer" },
  { role: "Generative AI / LLM Engineer",  location: "Bangalore",  experience: "3-5",  display: "GenAI Engineer" },
  { role: "Data Analyst",                  location: "Delhi NCR",  experience: "0-2",  display: "Data Analyst" },
  { role: "Business Analyst",              location: "Mumbai",     experience: "3-5",  display: "Business Analyst" },
  { role: "MLOps Engineer",                location: "Bangalore",  experience: "3-5",  display: "MLOps Engineer" },
  { role: "AI Research Scientist",         location: "Bangalore",  experience: "6-10", display: "AI Researcher" },
  { role: "Computer Vision Engineer",      location: "Hyderabad",  experience: "3-5",  display: "CV Engineer" },
  { role: "NLP Engineer",                  location: "Pune",       experience: "3-5",  display: "NLP Engineer" },
  { role: "BI Analyst",                    location: "Chennai",    experience: "0-2",  display: "BI Analyst" },
  { role: "Analytics Manager",             location: "Bangalore",  experience: "10+",  display: "Analytics Manager" },
  { role: "Data Scientist",                location: "Hyderabad",  experience: "6-10", display: "Senior Data Scientist" },
  { role: "AI Engineer / ML Engineer",     location: "Delhi NCR",  experience: "6-10", display: "Senior ML Engineer" },
  { role: "Generative AI / LLM Engineer",  location: "Mumbai",     experience: "6-10", display: "Senior GenAI Engineer" },
  { role: "Data Engineer",                 location: "Pune",       experience: "3-5",  display: "Data Engineer" },
];

// ── AI Assistant ──────────────────────────────────────────────────
export const AI_CONTEXT = "AnalytixLabs blog covering Data Science, Machine Learning, AI, Analytics, and career growth in India.";

export const SUGGESTED_AI_QUERIES = [
  "I'm a beginner, where to start?",
  "Best Python libraries for data science?",
  "How to build a machine learning portfolio?",
  "SQL vs Python for data analysis?",
  "Generative AI career roadmap 2026",
];

// ── Newsletter ────────────────────────────────────────────────────
export const NEWSLETTER = {
  title:       "Weekly Data Science and AI Digest",
  subtitle:    "Join 50,000+ data professionals and get instant access to research, tutorials & career insights, every Thursday.",
  placeholder: "Enter your work email",
  cta:         "Subscribe →",
  footnote:    "Free gift: Data Science Career Roadmap 2026 PDF on sign-up",
};

// ── Discussion / Comments ─────────────────────────────────────────
export const DEFAULT_COMMENTS = [
  {
    id: 1,
    user: "Ravi S.",
    time: "2 days ago",
    text: "Great breakdown! Can you cover Weaviate vs Pinecone comparison in the next article?",
    likes: 0,
    replies: [],
  },
  {
    id: 2,
    user: "Priya M.",
    time: "4 days ago",
    text: "The HNSW section was super clarifying. Bookmarked this for my team.",
    likes: 0,
    replies: [],
  },
];

// ── Featured Author slug ──────────────────────────────────────────
export const FEATURED_AUTHOR_SLUG = "al-editorial";

// ── Studio Constants ──────────────────────────────────────────────
export const STUDIO_DRAFT_KEY = "alabs_studio_draft";

export const STUDIO_CATEGORIES = [
  "Machine Learning",
  "Data Science",
  "Engineering",
  "Career Growth",
];

export const STUDIO_COURSES = [
  { id: "ml-fundamentals",      name: "ML Fundamentals" },
  { id: "data-science-bootcamp", name: "Data Science Bootcamp" },
  { id: "python-for-data",      name: "Python for Data" },
  { id: "deep-learning-pro",    name: "Deep Learning Pro" },
  { id: "sql-analytics",        name: "SQL & Analytics" },
];

export const STUDIO_LEAD_MAGNETS = [
  { id: "none",            name: "None" },
  { id: "ml-cheatsheet",   name: "ML Cheatsheet PDF" },
  { id: "sql-guide",       name: "SQL Quick Guide" },
  { id: "career-roadmap",  name: "Career Roadmap PDF" },
  { id: "python-snippets", name: "Python Snippets PDF" },
];

export const STUDIO_SCHEMA_TYPES = [
  "Article",
  "BlogPosting",
  "TechArticle",
  "HowTo",
  "FAQPage",
];

export const STUDIO_NEWSLETTER_PLACEMENTS = [
  { id: "after-intro",  label: "After intro" },
  { id: "mid-article",  label: "Mid article" },
  { id: "end",          label: "End of article" },
  { id: "none",         label: "None" },
];

export const STUDIO_MODERATION_MODES = ["auto", "manual", "off"];

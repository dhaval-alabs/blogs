import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import Link from "next/link";
import SalaryHubClient from "./SalaryHubClient";

const SITE_ORIGIN = "https://www.analytixlabs.co.in";

const TITLE = "Tech Salary Estimator for Data & AI Roles in India | AnalytixLabs";
const DESCRIPTION =
  "Free salary estimator for data analyst, data scientist, ML engineer, and other data & AI roles across Bangalore, Delhi NCR, Mumbai, Hyderabad, Pune, and Chennai — by experience level.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/salary-hub/` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_ORIGIN}/salary-hub/`,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Single source of truth for the visible FAQ block below AND the FAQPage
// schema — schema must mirror on-page content exactly.
const SALARY_FAQS = [
  {
    question: "How is this salary estimate calculated?",
    answer:
      "Each estimate combines a role's base compensation with a location multiplier (reflecting cost-of-living and demand differences across Indian tech hubs) and an experience-level multiplier, sourced from recent market compensation reports.",
  },
  {
    question: "Which roles and locations are covered?",
    answer:
      "Roles span data analytics, data science, machine learning, and AI engineering — including titles like Data Analyst, Data Scientist, ML Engineer, MLOps Engineer, and AI Research Scientist — across Bangalore, Delhi NCR, Mumbai, Hyderabad, Pune, Chennai, and remote roles.",
  },
  {
    question: "How often are the estimates refreshed?",
    answer:
      "Estimates are refreshed weekly. When live market data is unavailable, the tool falls back to its offline baseline estimate, which is shown clearly in the results.",
  },
  {
    question: "Is this the same as a guaranteed salary offer?",
    answer:
      "No — this is a directional estimate of base compensation to help with negotiation and career planning. Actual offers vary by company, specific skills, and individual negotiation.",
  },
];

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

const BREADCRUMB_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
    { "@type": "ListItem", position: 2, name: "Salary Hub", item: `${SITE_ORIGIN}/salary-hub/` },
  ],
};

const WEBPAGE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_ORIGIN}/salary-hub/#webpage`,
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_ORIGIN}/salary-hub/`,
  isPartOf: { "@type": "WebSite", url: SITE_ORIGIN },
  about: { "@type": "Thing", name: "Data & AI role compensation in India" },
  publisher: { "@type": "Organization", "@id": `${SITE_ORIGIN}/#organization` },
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_ORIGIN}/salary-hub/#faq`,
  mainEntity: SALARY_FAQS.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

// Genuinely relevant related reading — real posts on this same topic, not
// arbitrary internal-link padding.
const RELATED_POSTS = [
  { slug: "data-scientist-salary", label: "Data Scientist Salary in India: A Complete Breakdown" },
  { slug: "data-analyst-salary-in-india", label: "Data Analyst Salary in India" },
  { slug: "data-engineer-salary", label: "Data Engineer Salary Guide" },
];

export default function SalaryHubPage() {
  return (
    <div className="min-h-screen flex flex-col pt-16 font-[family-name:var(--font-body)] bg-background dark:bg-[#0b1326] text-on-background dark:text-[#dae2fd]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(WEBPAGE_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(BREADCRUMB_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(FAQ_JSON_LD) }}
      />

      <Navbar activeCategory="Salary Hub" />

      <main className="flex-1 w-full py-12 md:py-20">
        <div className="max-w-7xl mx-auto w-full px-6 mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold font-[family-name:var(--font-headline)] mb-4 tracking-tight">
            Tech Salary Estimator for Data &amp; AI Roles in India
          </h1>
          <p className="text-on-surface-variant dark:text-[#c2c6d6] text-lg leading-relaxed max-w-2xl">
            Built for job seekers, career switchers, and hiring managers who need a quick,
            directional read on what data analytics, data science, and AI/ML roles pay across
            India&apos;s major tech hubs — broken down by experience level.
          </p>
        </div>

        <SalaryHubClient />

        <div className="max-w-7xl mx-auto w-full px-6 mt-16 grid grid-cols-1 md:grid-cols-2 gap-12">
          <section>
            <h2 className="text-2xl font-bold font-[family-name:var(--font-headline)] mb-4">
              How We Calculate These Estimates
            </h2>
            <p className="text-on-surface-variant dark:text-[#c2c6d6] leading-relaxed mb-3">
              Each estimate starts from a role&apos;s base compensation, then applies two adjustments:
              a location multiplier reflecting cost-of-living and hiring-demand differences across
              Bangalore, Delhi NCR, Mumbai, Hyderabad, Pune, and Chennai, and an experience-level
              multiplier for early-career (0-2 years) through senior (10+ years) professionals.
            </p>
            <p className="text-on-surface-variant dark:text-[#c2c6d6] leading-relaxed">
              When live market data is available, the tool also surfaces year-over-year change and
              its sources; otherwise it shows an offline baseline estimate, labeled clearly in the
              results panel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-[family-name:var(--font-headline)] mb-4">
              Related Reading
            </h2>
            <ul className="flex flex-col gap-3">
              {RELATED_POSTS.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/blog/${p.slug}/`}
                    className="text-primary dark:text-[#adc6ff] font-semibold hover:underline"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="max-w-7xl mx-auto w-full px-6 mt-16">
          <section className="max-w-3xl">
            <h2 className="text-2xl font-bold font-[family-name:var(--font-headline)] mb-6">
              Frequently Asked Questions
            </h2>
            <div className="flex flex-col gap-6">
              {SALARY_FAQS.map((f) => (
                <div key={f.question}>
                  <h3 className="font-semibold text-base mb-1.5">{f.question}</h3>
                  <p className="text-on-surface-variant dark:text-[#c2c6d6] text-sm leading-relaxed">
                    {f.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
      <MobileBottomNav activePage="none" />
    </div>
  );
}

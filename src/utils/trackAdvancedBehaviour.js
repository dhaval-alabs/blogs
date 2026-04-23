let pageLoadTime = Date.now();
let maxScrollPct = 0;
let firstFieldTime = null;
let firstFieldName = "";
let interactionLog = [];
let lastClickTime = 0;
let clickCount = 0;
let initialized = false;

const getDeviceType = () => {
  if (typeof window === "undefined") return "Desktop";
  const w = window.innerWidth;
  if (w < 768) return "Mobile";
  if (w < 1024) return "Tablet";
  return "Desktop";
};

const logEvent = (msg) => {
  const time = Math.round((Date.now() - pageLoadTime) / 1000);
  interactionLog.push(`[${time}s] ${msg}`);
  if (interactionLog.length > 20) interactionLog.shift();
};

export const initAdvancedTracking = () => {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  pageLoadTime = Date.now();
  maxScrollPct = 0;
  interactionLog = ["Page Loaded"];

  const onScroll = () => {
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.body.scrollHeight;
    const pct = total > 0 ? Math.round((scrolled / total) * 100) : 0;
    if (pct > maxScrollPct) maxScrollPct = pct;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target) {
          const id =
            entry.target.id ||
            (entry.target.textContent || "").slice(0, 20).trim() ||
            "Unknown Section";
          logEvent(`Entered: ${id}`);
        }
      });
    },
    { threshold: 0.5 }
  );

  const observeSections = () => {
    document
      .querySelectorAll("h2, h3, section")
      .forEach((el) => observer.observe(el));
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(observeSections, 300);
  } else {
    window.addEventListener("DOMContentLoaded", observeSections);
  }

  window.addEventListener("click", (e) => {
    const now = Date.now();
    if (now - lastClickTime < 500) {
      clickCount++;
    } else {
      clickCount = 1;
    }
    lastClickTime = now;

    if (clickCount >= 3) {
      const tag = (e.target && e.target.tagName || "unknown").toLowerCase();
      logEvent(`RAGE CLICK detected on <${tag}>`);
      clickCount = 0;
    }

    const target = e.target;
    const tocLink = (target && typeof target.closest === "function") 
      ? target.closest('a[href^="#"]') 
      : null;

    if (tocLink) {
      logEvent(`TOC/Anchor Click: ${tocLink.getAttribute("href")}`);
    }
  });
};

export const recordFirstField = (fieldName) => {
  if (firstFieldTime !== null) return;
  firstFieldTime = Date.now();
  firstFieldName = fieldName;
  logEvent(`Started filling: ${fieldName}`);
};

export const getAdvancedBehaviourSnapshot = () => {
  if (typeof window === "undefined") return {};

  return {
    time_on_page_seconds: Math.round((Date.now() - pageLoadTime) / 1000),
    max_scroll_pct: maxScrollPct,
    form_completion_seconds: firstFieldTime
      ? Math.round((Date.now() - firstFieldTime) / 1000)
      : null,
    first_field_touched: firstFieldName || null,
    device_type: getDeviceType(),
    viewport_width: window.innerWidth,
    browser_info: navigator.userAgent.substring(0, 150),
    referrer_url: document.referrer || "Direct",
    landing_page_url: window.location.href,
    submission_timestamp: new Date().toISOString(),
    behaviour_log: interactionLog.join(" > "),
  };
};

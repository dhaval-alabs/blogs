export const captureUtmParams = () => {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
  ];

  keys.forEach((key) => {
    const value = params.get(key);
    if (value) sessionStorage.setItem(`alabs_blog_${key}`, value);
  });
};

export const getStoredUtm = () => {
  if (typeof window === "undefined") return {};
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
  ];
  return Object.fromEntries(
    keys.map((k) => [k, sessionStorage.getItem(`alabs_blog_${k}`) || ""])
  );
};

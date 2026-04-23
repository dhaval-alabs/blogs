"use client";

import Script from "next/script";

/**
 * All third-party tracking scripts consolidated in one component.
 * Loaded via next/script to avoid hydration issues and optimise loading.
 *
 * Includes:
 * - GTM via Stape (server-side)
 * - GTM standard (GTM-MN7KJTVN)
 * - ScaleX Consent, SDK, Init
 * - ScaleX 360 analytics
 * - Heap analytics
 */
export default function TrackingScripts() {
  return (
    <>
      {/* ── GTM via Stape (server-side) ── */}
      <Script id="gtm-stape" strategy="afterInteractive">{`
        !function(){"use strict";function l(e){for(var t=e,r=0,n=document.cookie.split(";");r<n.length;r++){var o=n[r].split("=");if(o[0].trim()===t)return o[1]}}function s(e){return localStorage.getItem(e)}function u(e){return window[e]}function A(e,t){e=document.querySelector(e);return t?null==e?void 0:e.getAttribute(t):null==e?void 0:e.textContent}var e=window,t=document,r="script",n="dataLayer",o="https://load.sgtmv1.analytixlabs.co.in",a="",i="t2Tfqaivmiy",c="bOmc=aWQ9R1RNLUtOQkRKSEw3&sort=desc",g="cookie",v="_sbp",E="",d=!1;try{var d=!!g&&(m=navigator.userAgent,!!(m=new RegExp("Version/([0-9._]+)(.*Mobile)?.*Safari.*").exec(m)))&&16.4<=parseFloat(m[1]),f="stapeUserId"===g,I=d&&!f?function(e,t,r){void 0===t&&(t="");var n={cookie:l,localStorage:s,jsVariable:u,cssSelector:A},t=Array.isArray(t)?t:[t];if(e&&n[e])for(var o=n[e],a=0,i=t;a<i.length;a++){var c=i[a],c=r?o(c,r):o(c);if(c)return c}else console.warn("invalid uid source",e)}(g,v,E):void 0;d=d&&(!!I||f)}catch(e){console.error(e)}var m=e,g=(m[n]=m[n]||[],m[n].push({"gtm.start":(new Date).getTime(),event:"gtm.js"}),t.getElementsByTagName(r)[0]),v=I?"&bi="+encodeURIComponent(I):"",E=t.createElement(r),f=(d&&(i=8<i.length?i.replace(/([a-z]{8}$)/,"kp$1"):"kp"+i),!d&&a?a:o);E.async=!0,E.src=f+"/"+i+".js?"+c+v,null!=(e=g.parentNode)&&e.insertBefore(E,g)}();
      `}</Script>

      {/* ── GTM Standard (GTM-MN7KJTVN) ── */}
      <Script id="gtm-standard" strategy="afterInteractive">{`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','GTM-MN7KJTVN');
      `}</Script>

      {/* ── jQuery (required by OwlCarousel) ── */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />

      {/* ── OwlCarousel ── */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/owl.carousel.min.js"
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />

      {/* ── ScaleX v0.2.5 Consent ── */}
      <Script
        src="https://www.analytixlabs.co.in/scalex/scalex-consent.js"
        strategy="lazyOnload"
      />

      {/* ── ScaleX SDK ── */}
      <Script
        src="https://www.analytixlabs.co.in/scalex/scalex-sdk.min.js"
        strategy="lazyOnload"
      />

      {/* ── ScaleX Init ── */}
      <Script
        src="https://www.analytixlabs.co.in/scalex/scalex.init.js"
        strategy="lazyOnload"
      />

      {/* ── ScaleX 360 Analytics ── */}
      <Script id="scalex-360" strategy="afterInteractive">{`
        (function () {
          const SUPABASE_ENDPOINT = "https://rcdmanmozzzqwnesaonr.supabase.co/functions/v1/track";
          const COOKIE_NAME = "scalex360_id";
          const MULTITOUCH_KEY = "scalex360_touch_history";
          const RATE_LIMIT_KEY = "scalex360_last_event_time";
          const RATE_LIMIT_SECONDS = 5;

          const generateUUID = () =>
            crypto.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
              const r = Math.random() * 16 | 0;
              const v = c === "x" ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });

          const setCookie = (name, value, days, domain) => {
            const expires = new Date(Date.now() + days * 864e5).toUTCString();
            document.cookie = name + "=" + value + "; path=/; expires=" + expires + "; domain=" + domain + "; SameSite=Lax; Secure";
          };

          const getCookie = (name) => {
            return document.cookie
              .split("; ")
              .find((row) => row.startsWith(name + "="))
              ?.split("=")[1];
          };

          const getOrCreateScaleXID = () => {
            let id = localStorage.getItem(COOKIE_NAME) || getCookie(COOKIE_NAME);
            if (!id) id = generateUUID();
            localStorage.setItem(COOKIE_NAME, id);
            setCookie(COOKIE_NAME, id, 365, ".analytixlabs.co.in");
            return id;
          };

          const getUTMParams = () => {
            const params = new URLSearchParams(window.location.search);
            return {
              utm_source: params.get("utm_source") || null,
              utm_medium: params.get("utm_medium") || null,
              utm_campaign: params.get("utm_campaign") || null,
              utm_content: params.get("utm_content") || null,
              utm_term: params.get("utm_term") || null,
            };
          };

          const getReferrer = () => document.referrer || null;

          const updateMultiTouchHistory = () => {
            const history = JSON.parse(localStorage.getItem(MULTITOUCH_KEY) || "[]");
            const utms = getUTMParams();
            const fingerprint = utms.utm_source + "|" + utms.utm_medium + "|" + utms.utm_campaign;
            if (!fingerprint.includes("null") && !history.some(h => h.fingerprint === fingerprint)) {
              history.push({
                ...utms,
                referrer: getReferrer(),
                timestamp: new Date().toISOString(),
                fingerprint
              });
              localStorage.setItem(MULTITOUCH_KEY, JSON.stringify(history.slice(-10)));
            }
            return history;
          };

          const isRateLimited = (eventType) => {
            const times = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || "{}");
            const now = Date.now();
            if (times[eventType] && now - times[eventType] < RATE_LIMIT_SECONDS * 1000) {
              return true;
            }
            times[eventType] = now;
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(times));
            return false;
          };

          const getElementorStats = () => {
            try {
              const data = JSON.parse(localStorage.getItem("elementor")) || {};
              return {
                elementor_pageViews: data.pageViews || 0,
                elementor_sessions: data.sessions || 0
              };
            } catch (e) {
              return {};
            }
          };

          const sendEvent = (eventType, extra) => {
            extra = extra || {};
            if (isRateLimited(eventType)) return;

            const payload = {
              scalex_id: getOrCreateScaleXID(),
              session_id: generateUUID(),
              event_type: eventType,
              timestamp: new Date().toISOString(),
              referrer: getReferrer(),
              page_url: window.location.href,
              ...getUTMParams(),
              multitouch_history: updateMultiTouchHistory(),
              extra_data: {
                ...getElementorStats(),
                ...extra
              }
            };

            fetch(SUPABASE_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            }).catch(err => {
              localStorage.setItem("scalex360_error", "Supabase send error: " + (err?.message || ""));
            });
          };

          sendEvent("page_viewed");

          const originalFetch = window.fetch;
          window.fetch = function (resource, config) {
            const isLeadSquared =
              typeof resource === "string" &&
              resource.includes("LeadManagement.svc/Lead.Capture") &&
              config?.method === "POST";

            if (isLeadSquared) {
              let formData = {};
              try {
                formData = JSON.parse(config.body);
              } catch (e) {
                return originalFetch.apply(this, arguments);
              }

              const getValue = (key) =>
                formData?.find(v => v.Attribute?.toLowerCase() === key.toLowerCase())?.Value || null;

              sendEvent("form_submitted", {
                email: getValue("EmailAddress"),
                phone: getValue("Phone"),
                city: getValue("mx_City"),
                source: getValue("Source"),
                type_filter: getValue("mx_Type_Filter")
              });
            }

            return originalFetch.apply(this, arguments);
          };
        })();
      `}</Script>

      {/* ── Heap Analytics ── */}
      <Script id="heap-analytics" strategy="afterInteractive">{`
        window.heapReadyCb=window.heapReadyCb||[],window.heap=window.heap||[],heap.load=function(e,t){window.heap.envId=e,window.heap.clientConfig=t=t||{},window.heap.clientConfig.shouldFetchServerConfig=!1;var a=document.createElement("script");a.type="text/javascript",a.async=!0,a.src="https://cdn.us.heap-api.com/config/"+e+"/heap_config.js";var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(a,r);var n=["init","startTracking","stopTracking","track","resetIdentity","identify","getSessionId","getUserId","getIdentity","addUserProperties","addEventProperties","removeEventProperty","clearEventProperties","addAccountProperties","addAdapter","addTransformer","addTransformerFn","onReady","addPageviewProperties","removePageviewProperty","clearPageviewProperties","trackPageview"],i=function(e){return function(){var t=Array.prototype.slice.call(arguments,0);window.heapReadyCb.push({name:e,fn:function(){heap[e]&&heap[e].apply(heap,t)}})}};for(var p=0;p<n.length;p++)heap[n[p]]=i(n[p])};
        heap.load("2336048362");
      `}</Script>
    </>
  );
}

import { NextResponse } from "next/server";

const LSQ_ACCESS = process.env.LSQ_ACCESS_KEY;
const LSQ_SECRET = process.env.LSQ_SECRET_KEY;
const LSQ_HOST = process.env.LSQ_HOST || "https://api-in21.leadsquared.com";

function formatLeadNotesFriendly(source) {
  if (!source) return "N/A";
  return `Blog | CTA: ${source.replace(/_/g, " ")}`;
}

export async function POST(req) {
  try {
    if (!LSQ_ACCESS || !LSQ_SECRET) {
      console.error("[Blog-CRM] Missing LSQ_ACCESS_KEY or LSQ_SECRET_KEY env vars");
      return NextResponse.json(
        { success: false, error: "CRM not configured" },
        { status: 500 }
      );
    }

    const CRM_WEBHOOK_URL = `${LSQ_HOST}/v2/LeadManagement.svc/Lead.Capture?accessKey=${LSQ_ACCESS}&secretKey=${LSQ_SECRET}`;

    const body = await req.json();

    const nameParts = (body.name || "").trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    let cleanMobile = (body.mobile || "").trim();
    if (
      body.countryCode === "+91" &&
      cleanMobile.startsWith("91") &&
      cleanMobile.length > 10
    ) {
      cleanMobile = cleanMobile.substring(2);
    }
    const lsqPhone =
      body.countryCode === "+91" ? cleanMobile : `${body.countryCode}${cleanMobile}`;

    const extraNotes = [
      `--- BLOG BEHAVIOR LOG ---`,
      `Form Source: ${body.form_source || "N/A"}`,
      `Time on Page: ${body.time_on_page_seconds || 0}s`,
      `Scroll Depth: ${body.max_scroll_pct || 0}%`,
      `Rage Clicks/Path: ${body.behaviour_log || "N/A"}`,
      `Referrer: ${body.referrer_url || "Direct"}`,
      `UTM Source: ${body.utm_source || "N/A"}`,
      `UTM Medium: ${body.utm_medium || "N/A"}`,
      `GCLID: ${body.gclid || "N/A"}`,
      `Device: ${body.device_type || "N/A"} (${body.viewport_width}px)`,
      `Submission URL: ${body.landing_page_url || "N/A"}`,
      `Timestamp: ${body.submission_timestamp || "N/A"}`,
    ].join("\n");

    const payload = [
      { Attribute: "FirstName", Value: firstName },
      { Attribute: "LastName", Value: lastName },
      { Attribute: "EmailAddress", Value: body.email },
      { Attribute: "Phone", Value: lsqPhone },
      { Attribute: "mx_City_name", Value: body.city },
      { Attribute: "Source", Value: body.typeFilter || "Blog_Submission" },
      { Attribute: "mx_Extra_Notes", Value: extraNotes },
      { Attribute: "Notes", Value: formatLeadNotesFriendly(body.form_source) },
    ];

    console.log("[Blog-CRM] Submitting Lead:", JSON.stringify(payload, null, 2));

    const response = await fetch(CRM_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Blog-CRM] LeadSquared error:", response.status, errorText);
      return NextResponse.json(
        { success: false, error: "CRM submission failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Blog-CRM] API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

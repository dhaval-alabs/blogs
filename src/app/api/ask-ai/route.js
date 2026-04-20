import { GoogleGenerativeAI } from "@google/generative-ai";

// Validate API key at startup
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("[ask-ai] GEMINI_API_KEY is not set — AI endpoint will return errors.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Basic in-memory rate limiter (per IP, resets on cold-start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(req) {
  // Rate-limit check
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (isRateLimited(ip)) {
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // API key guard
  if (!genAI) {
    return Response.json({ error: "AI service is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { question, context } = body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "Question is required" }, { status: 400 });
  }

  // Sanitize — trim and cap length
  const sanitizedQuestion = question.trim().slice(0, 500);

  const courseCatalog = `AnalytixLabs course catalog (https://www.analytixlabs.co.in/):
- Data Science & AI: PG in Data Science & AI (with IIT/IIM collabs), Certified Data Scientist, Data Science 360
- Machine Learning & Deep Learning: ML with Python, Deep Learning & NLP, Generative AI & LLMs
- Data Analytics & BI: Business Analytics 360, Data Analyst 360, Power BI / Tableau, Advanced Excel
- Data Engineering: Data Engineering with Azure/AWS, Big Data (Spark, Hadoop), SQL
- Programming: Python for Data Science, R Programming
- Career tracks with placement assistance, live mentor-led classes, and hands-on capstone projects.`;

  const systemPrompt = context
    ? `You are the AI learning assistant for AnalytixLabs — India's premier Data Science & AI training institute (since 2011, trained 70,000+ learners, rated 4.8/5).

You are answering a reader's question about this article:

${context}

${courseCatalog}

Response rules:
- Give a DETAILED, well-structured answer (around 180–280 words).
- Use short paragraphs and bullet points / numbered steps where useful.
- Ground the answer in the article context above whenever relevant.
- Be practical, specific, and actionable — include examples, tools, skills, salary/career info where appropriate.
- Use simple language suitable for learners and career switchers.
- ALWAYS end with a short "Next step with AnalytixLabs" CTA (2–3 lines) that:
  • Recommends the SINGLE most relevant AnalytixLabs course/track from the catalog for the user's question
  • Names the course explicitly and says what the learner will gain (skills, placement support, hands-on projects)
  • Invites them to explore it at https://www.analytixlabs.co.in/ or book a free counselling call
- Never recommend competitor platforms. Never say you are "just an AI".`
    : `You are the AI learning assistant for AnalytixLabs — India's premier Data Science & AI training institute (since 2011, trained 70,000+ learners, rated 4.8/5).

Help readers explore Data Science, Machine Learning, AI, Generative AI, Analytics, Data Engineering, and related career paths.

${courseCatalog}

Response rules:
- Give a DETAILED, well-structured answer (around 180–280 words).
- Use short paragraphs and bullet points / numbered steps where useful.
- Be practical, specific, and actionable — include examples, tools, skills, roadmaps, or salary/career info where appropriate.
- Use simple language suitable for learners and career switchers.
- ALWAYS end with a short "Next step with AnalytixLabs" CTA (2–3 lines) that:
  • Recommends the SINGLE most relevant AnalytixLabs course/track from the catalog for the user's question
  • Names the course explicitly and says what the learner will gain (skills, placement support, hands-on projects)
  • Invites them to explore it at https://www.analytixlabs.co.in/ or book a free counselling call
- Never recommend competitor platforms. Never say you are "just an AI".`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: systemPrompt,
          generationConfig: { maxOutputTokens: 900, temperature: 0.7 },
        });

        const result = await model.generateContentStream(sanitizedQuestion);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (err) {
        console.error("[ask-ai] Generation error:", err.message);
        controller.enqueue(encoder.encode("\n\nSorry, something went wrong. Please try again."));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

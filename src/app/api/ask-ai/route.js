import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getKnowledgeBase,
  rankRelevantArticles,
  formatKnowledgeForPrompt,
} from "@/lib/ai-knowledge.server";
import { aiGuard, logAiUsage, rateLimitedResponse } from "@/lib/ai-guard.server";

// Validate API key at startup
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("[ask-ai] GEMINI_API_KEY is not set — AI endpoint will return errors.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MODEL = "gemini-2.5-flash";

export async function POST(req) {
  // Shared, cross-instance rate limit + global daily cap, and every request is
  // logged. The old limiter was a module-scope Map keyed on the raw
  // x-forwarded-for header: empty on each cold start, unshared between
  // instances, and bypassable by varying a header. See lib/ai-guard.server.js.
  const guard = await aiGuard(req, "ask-ai");
  if (!guard.allowed) {
    logAiUsage({ route: "ask-ai", ipHash: guard.ipHash, model: MODEL, outcome: guard.reason,
                 detail: guard.degraded ? "degraded: shared counters unavailable" : null });
    return rateLimitedResponse(guard.reason);
  }

  // API key guard
  if (!genAI) {
    logAiUsage({ route: "ask-ai", ipHash: guard.ipHash, outcome: "error", detail: "GEMINI_API_KEY not set" });
    return Response.json({ error: "AI service is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { question, context, tags, slug } = body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "Question is required" }, { status: 400 });
  }

  // Sanitize — trim and cap length
  const sanitizedQuestion = question.trim().slice(0, 500);

  // Pull the most relevant articles from across the whole blog so the AI can
  // ground its answer in real AnalytixLabs content and link back to it.
  let knowledgeBlock = "";
  try {
    await getKnowledgeBase();
    const relevant = rankRelevantArticles({
      question: sanitizedQuestion,
      articleTags: Array.isArray(tags) ? tags : [],
      currentSlug: typeof slug === "string" ? slug : null,
      limit: 6,
    });
    knowledgeBlock = formatKnowledgeForPrompt(relevant);
  } catch (err) {
    console.error("[ask-ai] knowledge lookup failed:", err.message);
  }

  const courseCatalog = `AnalytixLabs course catalog (https://www.analytixlabs.co.in/):
- Data Science & AI: PG in Data Science & AI (with IIT/IIM collabs), Certified Data Scientist, Data Science 360
- Machine Learning & Deep Learning: ML with Python, Deep Learning & NLP, Generative AI & LLMs
- Data Analytics & BI: Business Analytics 360, Data Analyst 360, Power BI / Tableau, Advanced Excel
- Data Engineering: Data Engineering with Azure/AWS, Big Data (Spark, Hadoop), SQL
- Programming: Python for Data Science, R Programming
- Career tracks with placement assistance, live mentor-led classes, and hands-on capstone projects.`;

  const knowledgeSection = knowledgeBlock
    ? `Relevant AnalytixLabs blog articles you can reference and link to (use inline markdown links like [title](url) where helpful — do NOT fabricate URLs, only use the ones below):
${knowledgeBlock}
`
    : "";

  const sharedRules = `Response rules:
- Give a DETAILED, well-structured answer (around 180–280 words).
- Use short paragraphs and bullet points / numbered steps where useful.
- Be practical, specific, and actionable — include examples, tools, skills, salary/career info where appropriate.
- Use simple language suitable for learners and career switchers.
- When an article from the "Relevant AnalytixLabs blog articles" list above genuinely helps, cite it as a markdown link using ONLY the exact URL provided. Never invent URLs. Mention at most 2 articles.
- ALWAYS end with a short "Next step with AnalytixLabs" CTA (2–3 lines) that:
  • Recommends the SINGLE most relevant AnalytixLabs course/track from the catalog for the user's question
  • Names the course explicitly and says what the learner will gain (skills, placement support, hands-on projects)
  • MUST include TWO clickable markdown links written EXACTLY in this form:
      → [Explore the course](https://www.analytixlabs.co.in/)
      → [Book a free counselling call](https://www.analytixlabs.co.in/contact-us)
  • Never output a bare URL — always wrap it as [label](https://...) so it renders as a clickable link
  • Never use placeholders like (link), (url), or (here) — always use the real URLs above
- This CTA is non-negotiable — every answer must end with it, even for off-topic questions (gently steer back to a relevant AnalytixLabs course).
- Never recommend competitor platforms (upGrad, Coursera, Simplilearn, Scaler, etc.). Never say you are "just an AI".`;

  const systemPrompt = context
    ? `You are the AI learning assistant for AnalytixLabs — India's premier Data Science & AI training institute (since 2011, trained 70,000+ learners, rated 4.8/5).

You are answering a reader's question about this article:

${context}

${courseCatalog}

${knowledgeSection}${sharedRules}
- Ground the answer in the article context above whenever relevant.`
    : `You are the AI learning assistant for AnalytixLabs — India's premier Data Science & AI training institute (since 2011, trained 70,000+ learners, rated 4.8/5).

Help readers explore Data Science, Machine Learning, AI, Generative AI, Analytics, Data Engineering, and related career paths.

${courseCatalog}

${knowledgeSection}${sharedRules}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const model = genAI.getGenerativeModel({
          model: MODEL,
          systemInstruction: systemPrompt,
          generationConfig: {
            maxOutputTokens: 1200,
            temperature: 0.7,
            // Disable "thinking" so the entire token budget goes to visible output.
            // Without this, gemini-2.5-flash can burn the full budget on hidden
            // reasoning and return an empty / CTA-truncated answer.
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        const result = await model.generateContentStream(sanitizedQuestion);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
        logAiUsage({ route: "ask-ai", ipHash: guard.ipHash, model: MODEL, outcome: "served",
                     questionChars: sanitizedQuestion.length,
                     detail: guard.degraded ? "degraded: shared counters unavailable" : null });
      } catch (err) {
        console.error("[ask-ai] Generation error:", err.message);
        controller.enqueue(encoder.encode("\n\nSorry, something went wrong. Please try again."));
        controller.close();
        logAiUsage({ route: "ask-ai", ipHash: guard.ipHash, model: MODEL, outcome: "error",
                     questionChars: sanitizedQuestion.length, detail: err.message });
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

import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiGuard, logAiUsage, rateLimitedResponse } from "@/lib/ai-guard.server";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MODEL = "gemini-3.6-flash";

export async function POST(req) {
  // Same shared guard as /api/ask-ai — one Gemini call per request, so this
  // endpoint needs the same protection. It answers with an empty questions[]
  // rather than an error object, because the widget renders this inline and a
  // missing suggestion list must degrade quietly.
  const guard = await aiGuard(req, "ask-ai/followups");
  if (!guard.allowed) {
    logAiUsage({ route: "ask-ai/followups", ipHash: guard.ipHash, model: MODEL, outcome: guard.reason,
                 detail: guard.degraded ? "degraded: shared counters unavailable" : null });
    return rateLimitedResponse(guard.reason, "questions");
  }
  if (!genAI) {
    logAiUsage({ route: "ask-ai/followups", ipHash: guard.ipHash, outcome: "error", detail: "GEMINI_API_KEY not set" });
    return Response.json({ questions: [] }, { status: 503 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ questions: [] }, { status: 400 }); }

  const question = String(body.question || "").trim().slice(0, 500);
  const answer = String(body.answer || "").trim().slice(0, 2000);
  const context = String(body.context || "").trim().slice(0, 3000);
  if (!question || !answer) return Response.json({ questions: [] });

  const prompt = `You are generating follow-up questions for a reader of AnalytixLabs (a Data Science & AI education platform).

The reader asked:
"${question}"

They received this answer:
"""
${answer}
"""

${context ? `Article context:\n"""${context}"""\n` : ""}

Generate exactly 3 short follow-up questions the reader is LIKELY to ask next. Rules:
- Each question: 4-10 words, ends with "?"
- Natural-sounding, curious-learner voice
- Should deepen understanding, explore adjacent topics, or ask about careers/courses
- Return ONLY a JSON array of 3 strings. No prose, no code fences, no keys.

Example output:
["What skills do I need first?","How long to become job-ready?","Which course fits a beginner?"]`;

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        // gemini-3.6-flash can't disable thinking (thinkingBudget: 0 is
        // rejected) — "low" is the minimum, and it alone can eat ~150-200
        // tokens before any visible output, so the old 200-token budget
        // truncated the JSON array mid-string. Bumped for headroom.
        maxOutputTokens: 500,
        temperature: 0.8,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "low" },
      },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(text);
    const questions = Array.isArray(parsed)
      ? parsed.filter((q) => typeof q === "string" && q.length > 3).slice(0, 3)
      : [];
    logAiUsage({ route: "ask-ai/followups", ipHash: guard.ipHash, model: MODEL, outcome: "served",
                 questionChars: question.length,
                 detail: guard.degraded ? "degraded: shared counters unavailable" : null });
    return Response.json({ questions });
  } catch (err) {
    console.error("[ask-ai/followups] error:", err.message);
    logAiUsage({ route: "ask-ai/followups", ipHash: guard.ipHash, model: MODEL, outcome: "error",
                 questionChars: question.length, detail: err.message });
    return Response.json({ questions: [] });
  }
}

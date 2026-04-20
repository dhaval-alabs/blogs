import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const rateLimitMap = new Map();
const WINDOW_MS = 60_000;
const MAX = 20;

function limited(ip) {
  const now = Date.now();
  const e = rateLimitMap.get(ip);
  if (!e || now - e.t > WINDOW_MS) { rateLimitMap.set(ip, { t: now, n: 1 }); return false; }
  e.n++;
  return e.n > MAX;
}

export async function POST(req) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (limited(ip)) return Response.json({ questions: [] }, { status: 429 });
  if (!genAI) return Response.json({ questions: [] }, { status: 503 });

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
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.8,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(text);
    const questions = Array.isArray(parsed)
      ? parsed.filter((q) => typeof q === "string" && q.length > 3).slice(0, 3)
      : [];
    return Response.json({ questions });
  } catch (err) {
    console.error("[ask-ai/followups] error:", err.message);
    return Response.json({ questions: [] });
  }
}

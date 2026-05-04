import { NextResponse } from "next/server";

type Body = {
  mode: "insights" | "chat";
  dataSummary: string;
  question?: string;
  history?: { role: "user" | "assistant"; content: string }[];
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ text: "OPENROUTER_API_KEY not set. Add it in .env.local." }, { status: 500 });
  }

  const system =
    body.mode === "insights"
      ? "You are a business analytics assistant. Return concise sections: Automatic Insights, Recommendations, Warnings. Ground every claim in provided summary."
      : "You are a context-aware analytics copilot. Answer with concrete data-backed reasoning and include assumptions when simulating what-if scenarios.";

  const userPrompt =
    body.mode === "insights"
      ? `Generate portfolio-demo quality insights from:\n${body.dataSummary}`
      : `Dataset summary:\n${body.dataSummary}\n\nQuestion: ${body.question ?? ""}`;

  const messages = [
    { role: "system", content: system },
    ...(body.history ?? []),
    { role: "user", content: userPrompt }
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-8b-instruct:free",
      messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ text: `OpenRouter error: ${err}` }, { status: 500 });
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content ?? "No AI response.";
  return NextResponse.json({ text });
}

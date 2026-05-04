"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { templatesByIndustry, type IndustryKey, type TemplateDef } from "@/lib/templates";
import { supabase } from "@/lib/supabase";

type Row = Record<string, string | number>;
type ChatMsg = { role: "user" | "assistant"; content: string };

type MetricPoint = { name: string; value: number };
type TrendPoint = { date: string; value: number };

const industries = Object.keys(templatesByIndustry) as IndustryKey[];

function toCsv(rows: Row[]) {
  return Papa.unparse(rows);
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeFilePath(path: string) {
  const base = process.env.NODE_ENV === "production" ? "/demo" : "";
  return `${base}${path}`;
}

function buildDemoInsights(industry: IndustryKey | null, topSegments: MetricPoint[], stats: { revenue: number; rowCount: number } | null) {
  const leader = topSegments[0];
  const second = topSegments[1];
  const concentration = leader && stats?.revenue ? Math.round((leader.value / stats.revenue) * 100) : 0;

  return [
    "AUTOMATIC INSIGHTS",
    leader ? `- ${leader.name} is the top segment, contributing about ${concentration}% of total value.` : "- Top segment is not available yet.",
    second ? `- ${second.name} is the second strongest segment and can be benchmarked against the leader.` : "- Add more segment diversity for stronger comparison.",
    stats ? `- Dataset includes ${stats.rowCount.toLocaleString()} rows with total value ${stats.revenue.toLocaleString()}.` : "- Upload data to generate data-backed summary.",
    "",
    "RECOMMENDATIONS",
    `- Prioritize ${industry ?? "selected"} segments with stronger trend consistency over one-time spikes.",
    "- Validate operational bottlenecks in lower-performing segments before increasing budget.",
    "",
    "WARNINGS",
    "- This is demo mode (no OpenRouter key). Insights are heuristic, not LLM-generated.",
    "- For production-grade recommendations, enable OpenRouter key or move AI calls to a secure backend."
  ].join("\n");
}

function demoChatAnswer(question: string, topSegments: MetricPoint[], trend: TrendPoint[]) {
  const q = question.toLowerCase();
  const leader = topSegments[0];
  const lastTwo = trend.slice(-2);

  if (q.includes("expand") || q.includes("which department") || q.includes("which segment")) {
    return leader
      ? `Based on the uploaded data, ${leader.name} is currently the strongest segment. I would prioritize expansion there while running a pilot for the second-ranked segment.`
      : "I need uploaded data first to recommend expansion priorities.";
  }

  if (q.includes("trend") || q.includes("july") || q.includes("month")) {
    if (lastTwo.length === 2) {
      const delta = lastTwo[1].value - lastTwo[0].value;
      const direction = delta >= 0 ? "up" : "down";
      return `Recent trend looks ${direction}: ${lastTwo[0].date} (${lastTwo[0].value}) to ${lastTwo[1].date} (${lastTwo[1].value}).`;
    }
    return "There are not enough dated records yet to compute a directional trend.";
  }

  if (q.includes("why")) {
    return "In demo mode, I estimate likely drivers as volume concentration, seasonality, and service mix. Add OpenRouter key for deeper causal analysis from LLM.";
  }

  return "Demo mode answer: your dataset is loaded and charted. Ask about trends, top segments, or expansion priority for more targeted guidance.";
}

export default function AnalyzerPage() {
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [template, setTemplate] = useState<TemplateDef | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState("Upload a CSV to generate insights.");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState("");

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const dateKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("date")) || "Date";
    const revKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr" || k.toLowerCase() === "price") || "Revenue";
    const dates = rows.map((r) => new Date(String(r[dateKey]))).filter((d) => !Number.isNaN(d.getTime()));
    const revenue = rows.reduce((acc, r) => acc + Number(r[revKey] ?? 0), 0);
    return {
      rowCount: rows.length,
      minDate: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : "N/A",
      maxDate: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : "N/A",
      revenue
    };
  }, [rows]);

  const segmentRevenue = useMemo(() => {
    if (!rows.length) return [] as MetricPoint[];
    const segKey = Object.keys(rows[0]).find((k) => ["department", "category", "store", "channel", "line", "location", "plan"].includes(k.toLowerCase())) || "Department";
    const revKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr" || k.toLowerCase() === "price") || "Revenue";
    const map = new Map<string, number>();

    for (const r of rows) {
      const key = String(r[segKey] ?? "Unknown");
      map.set(key, (map.get(key) ?? 0) + Number(r[revKey] ?? 0));
    }

    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const trend = useMemo(() => {
    if (!rows.length) return [] as TrendPoint[];
    const dateKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("date")) || "Date";
    const valKey =
      Object.keys(rows[0]).find((k) => ["patient count", "order count", "orders", "new customers", "output", "units"].includes(k.toLowerCase())) ||
      Object.keys(rows[0]).find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr") ||
      "Patient Count";

    const map = new Map<string, number>();
    for (const r of rows) {
      const key = String(r[dateKey]).slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Number(r[valKey] ?? 0));
    }

    return [...map.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const pieData = useMemo(() => segmentRevenue.slice(0, 6), [segmentRevenue]);

  async function callOpenRouter(payload: { mode: "insights" | "chat"; dataSummary: string; question?: string; history?: ChatMsg[] }) {
    if (!openRouterKey.trim()) {
      throw new Error("Demo mode active");
    }

    const system =
      payload.mode === "insights"
        ? "You are a business analytics assistant. Return concise sections: Automatic Insights, Recommendations, Warnings. Ground every claim in provided summary."
        : "You are a context-aware analytics copilot. Answer with concrete data-backed reasoning and include assumptions when simulating what-if scenarios.";

    const userPrompt =
      payload.mode === "insights"
        ? `Generate portfolio-demo quality insights from:\n${payload.dataSummary}`
        : `Dataset summary:\n${payload.dataSummary}\n\nQuestion: ${payload.question ?? ""}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-8b-instruct:free",
        messages: [{ role: "system", content: system }, ...(payload.history ?? []), { role: "user", content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error: ${err}`);
    }

    const json = await response.json();
    return json?.choices?.[0]?.message?.content ?? "No AI response.";
  }

  async function handleUpload(file: File) {
    setError(null);

    const parsed = await new Promise<Papa.ParseResult<Row>>((resolve) => {
      Papa.parse<Row>(file, { header: true, skipEmptyLines: true, complete: resolve });
    });

    const data = parsed.data;
    if (!template) return;
    if (!data.length) {
      setError("CSV is empty.");
      return;
    }

    if (data.length > 100000) {
      setError("Row count exceeds 100,000.");
      return;
    }

    const cols = Object.keys(data[0] ?? {});
    const missing = template.requiredColumns.filter((c) => !cols.includes(c));
    if (missing.length) {
      setError(`Missing required columns: ${missing.join(", ")}`);
      return;
    }

    const first = data[0];
    if (template.requiredColumns.some((c) => c.toLowerCase().includes("date")) && Number.isNaN(new Date(String(first["Date"])).getTime())) {
      setError("Date column contains invalid values.");
      return;
    }

    setRows(data);

    if (supabase) {
      await supabase
        .from("uploaded_records")
        .insert(data.slice(0, 5000).map((r) => ({ industry, template_id: template.id, payload: r })));
    }

    const summary = JSON.stringify(
      {
        industry,
        template: template.name,
        rowCount: data.length,
        topSegments: segmentRevenue.slice(0, 5),
        sampleRows: data.slice(0, 10)
      },
      null,
      2
    );

    setLoadingAI(true);
    try {
      const text = await callOpenRouter({ mode: "insights", dataSummary: summary });
      setInsights(text || "Could not generate insights.");
    } catch {
      setInsights(buildDemoInsights(industry, segmentRevenue, stats));
    } finally {
      setLoadingAI(false);
    }
  }

  async function ask() {
    if (!question.trim() || !rows.length) return;

    const next = [...chat, { role: "user" as const, content: question }];
    setChat(next);
    setQuestion("");

    const summary = `Industry: ${industry}\nTemplate: ${template?.name}\nRows: ${rows.length}\nTop segments: ${JSON.stringify(segmentRevenue.slice(0, 5))}`;

    try {
      const text = await callOpenRouter({ mode: "chat", dataSummary: summary, question, history: next });
      setChat([...next, { role: "assistant", content: text || "No response" }]);
    } catch {
      setChat([...next, { role: "assistant", content: demoChatAnswer(question, segmentRevenue, trend) }]);
    }
  }

  return (
    <main className="shell analyzer-shell">
      <header className="hero-block">
        <p className="eyebrow">Portfolio Demo</p>
        <h1>Interactive Industry Analyzer</h1>
        <p>Upload CSV data, auto-build charts, and explore insights with AI or built-in demo intelligence.</p>
      </header>

      <section className="panel panel-hero">
        <div>
          <h2>AI Access</h2>
          <p className="hint">Leave blank to use demo mode. Add key only when you need real OpenRouter responses.</p>
        </div>
        <input type="password" placeholder="Optional: sk-or-v1-..." value={openRouterKey} onChange={(e) => setOpenRouterKey(e.target.value)} />
      </section>

      <section className="panel">
        <h2>1. Select Industry</h2>
        <div className="chip-grid">
          {industries.map((name) => (
            <button
              key={name}
              className={industry === name ? "chip active" : "chip"}
              onClick={() => {
                setIndustry(name);
                setTemplate(null);
                setRows([]);
                setInsights("Upload a CSV to generate insights.");
                setChat([]);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {industry && (
        <section className="panel">
          <h2>2. Select Template</h2>
          <div className="template-grid">
            {templatesByIndustry[industry].map((t) => (
              <button key={t.id} className={template?.id === t.id ? "template-card active" : "template-card"} onClick={() => setTemplate(t)}>
                <strong>{t.name}</strong>
                <span>{t.requiredColumns.length} required fields</span>
              </button>
            ))}
          </div>

          {template && (
            <div className="template-actions">
              <p><strong>Expected columns:</strong> {template.requiredColumns.join(", ")}</p>
              <div className="action-row">
                <button
                  className="btn"
                  onClick={() =>
                    download(
                      `${template.id}-template.csv`,
                      toCsv(template.sampleRows.length ? template.sampleRows : [Object.fromEntries(template.requiredColumns.map((c) => [c, ""]))])
                    )
                  }
                >
                  Download Template
                </button>
                <a className="btn ghost" href={normalizeFilePath(template.sampleFile)} download>
                  Download Repo Sample CSV
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {template && (
        <section className="panel">
          <h2>3. Upload & Validate Data</h2>
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          {error && <p className="error">{error}</p>}

          {stats && (
            <div className="stats-grid">
              <article><span>Rows</span><strong>{stats.rowCount.toLocaleString()}</strong></article>
              <article><span>Date Range</span><strong>{stats.minDate} to {stats.maxDate}</strong></article>
              <article><span>Total Value</span><strong>{stats.revenue.toLocaleString()}</strong></article>
            </div>
          )}

          {!!rows.length && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!!rows.length && (
        <section className="panel">
          <h2>4. Auto Visualizations</h2>
          <div className="chart-grid">
            <div className="chart"><h3>Revenue by Segment</h3><ResponsiveContainer width="100%" height={280}><BarChart data={segmentRevenue}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2f6bff" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div className="chart"><h3>Volume Trend</h3><ResponsiveContainer width="100%" height={280}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#ff6b57" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>
            <div className="chart"><h3>Distribution</h3><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>{pieData.map((_, i) => <Cell key={i} fill={["#2f6bff", "#14b8a6", "#ff6b57", "#84cc16", "#f59e0b", "#8b5cf6"][i % 6]} />)}</Pie></PieChart></ResponsiveContainer></div>
            <div className="chart"><h3>Top 5 Segments</h3><ol>{segmentRevenue.slice(0, 5).map((d) => <li key={d.name}>{d.name}: {d.value.toLocaleString()}</li>)}</ol></div>
          </div>
        </section>
      )}

      {!!rows.length && (
        <section className="panel split">
          <div>
            <h2>5. AI Insights</h2>
            <pre className="insights">{loadingAI ? "Generating insights..." : insights}</pre>
          </div>
          <div>
            <h2>6. AI Chatbot</h2>
            <div className="chatbox">
              {chat.map((m, idx) => <p key={idx}><strong>{m.role === "user" ? "You" : "AI"}:</strong> {m.content}</p>)}
            </div>
            <div className="chatinput">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask follow-up questions..." />
              <button className="btn" onClick={ask}>Send</button>
            </div>
          </div>
        </section>
      )}

      {!!rows.length && (
        <section className="panel">
          <h2>7. Export & Share</h2>
          <div className="action-row">
            <button className="btn" onClick={() => window.print()}>Download as PDF</button>
            <button className="btn ghost" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy Share Link</button>
          </div>
        </section>
      )}
    </main>
  );
}

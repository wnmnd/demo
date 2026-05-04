"use client";

import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
const palette = ["#2563eb", "#0891b2", "#f97316", "#84cc16", "#e11d48", "#7c3aed", "#ea580c"];

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

function buildDemoInsights(industry: IndustryKey | null, top: MetricPoint[], total: number, rowCount: number) {
  const lead = top[0];
  const second = top[1];
  return [
    "AUTOMATIC INSIGHTS",
    lead ? `- ${lead.name} is leading with ${(lead.value / Math.max(total, 1) * 100).toFixed(1)}% share.` : "- Upload data to identify the leading segment.",
    second ? `- ${second.name} is the runner-up and worth tracking for uplift opportunities.` : "- More segment diversity would improve comparative insights.",
    `- Processed ${rowCount.toLocaleString()} rows with total tracked value ${total.toLocaleString()}.`,
    "",
    "RECOMMENDATIONS",
    `- In ${industry ?? "this industry"}, focus resource allocation around leading segments while testing one challenger segment.`,
    "- Watch volatility in daily trend before committing long-term budget.",
    "",
    "WARNINGS",
    "- Running in demo intelligence mode because no OpenRouter key is active.",
    "- Use a backend-proxied key for production-grade secure AI."
  ].join("\n");
}

function demoChat(question: string, trend: TrendPoint[], top: MetricPoint[]) {
  const q = question.toLowerCase();
  if (!top.length) return "Upload a dataset first and I can answer with concrete numbers.";

  if (q.includes("expand") || q.includes("which")) {
    return `I would expand ${top[0].name} first, then pilot ${top[1]?.name ?? "the next strongest segment"}.`;
  }

  if (q.includes("why") || q.includes("high")) {
    return `${top[0].name} is likely high due to mix concentration and volume density compared with other segments.`;
  }

  if (q.includes("trend") || q.includes("month") || q.includes("july")) {
    const last = trend.at(-1);
    const prev = trend.at(-2);
    if (last && prev) {
      const delta = last.value - prev.value;
      return `Latest change: ${prev.date} -> ${last.date}, ${delta >= 0 ? "+" : ""}${delta.toLocaleString()} (${((delta / Math.max(prev.value, 1)) * 100).toFixed(1)}%).`;
    }
  }

  return `Top segment is ${top[0].name}. Ask me about growth, expansion priority, or monthly changes for a sharper answer.`;
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
  const [topN, setTopN] = useState(5);
  const [chartMode, setChartMode] = useState<"bar" | "area">("bar");
  const [focusSegment, setFocusSegment] = useState("All");

  useEffect(() => {
    const defaultKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? "";
    if (defaultKey) setOpenRouterKey(defaultKey);
  }, []);

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const keys = Object.keys(rows[0]);
    const dateKey = keys.find((k) => k.toLowerCase().includes("date")) || "Date";
    const valKey = keys.find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr" || k.toLowerCase() === "price") || "Revenue";
    const dates = rows.map((r) => new Date(String(r[dateKey]))).filter((d) => !Number.isNaN(d.getTime()));
    const total = rows.reduce((a, r) => a + Number(r[valKey] ?? 0), 0);
    return {
      rowCount: rows.length,
      total,
      minDate: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : "N/A",
      maxDate: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : "N/A"
    };
  }, [rows]);

  const segmentRevenue = useMemo(() => {
    if (!rows.length) return [] as MetricPoint[];
    const keys = Object.keys(rows[0]);
    const segKey = keys.find((k) => ["department", "category", "store", "channel", "line", "location", "plan"].includes(k.toLowerCase())) || "Department";
    const valKey = keys.find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr" || k.toLowerCase() === "price") || "Revenue";
    const map = new Map<string, number>();

    for (const r of rows) {
      const seg = String(r[segKey] ?? "Unknown");
      if (focusSegment !== "All" && seg !== focusSegment) continue;
      map.set(seg, (map.get(seg) ?? 0) + Number(r[valKey] ?? 0));
    }

    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows, focusSegment]);

  const trend = useMemo(() => {
    if (!rows.length) return [] as TrendPoint[];
    const keys = Object.keys(rows[0]);
    const dateKey = keys.find((k) => k.toLowerCase().includes("date")) || "Date";
    const segKey = keys.find((k) => ["department", "category", "store", "channel", "line", "location", "plan"].includes(k.toLowerCase())) || "Department";
    const valKey =
      keys.find((k) => ["patient count", "order count", "orders", "new customers", "output", "units"].includes(k.toLowerCase())) ||
      keys.find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr") ||
      "Patient Count";
    const map = new Map<string, number>();

    for (const r of rows) {
      const seg = String(r[segKey] ?? "Unknown");
      if (focusSegment !== "All" && seg !== focusSegment) continue;
      const date = String(r[dateKey]).slice(0, 10);
      map.set(date, (map.get(date) ?? 0) + Number(r[valKey] ?? 0));
    }

    return [...map.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  }, [rows, focusSegment]);

  const segments = useMemo(() => ["All", ...new Set(segmentRevenue.map((s) => s.name))], [segmentRevenue]);
  const topSegments = segmentRevenue.slice(0, topN);
  const shareData = segmentRevenue.slice(0, 6);

  async function callOpenRouter(payload: { mode: "insights" | "chat"; dataSummary: string; question?: string; history?: ChatMsg[] }) {
    if (!openRouterKey.trim()) {
      throw new Error("No key set");
    }

    const system = payload.mode === "insights"
      ? "You are a business analytics assistant. Return concise sections: Automatic Insights, Recommendations, Warnings. Ground every claim in provided summary."
      : "You are a context-aware analytics copilot. Answer with concrete data-backed reasoning and include assumptions for what-if scenarios.";

    const prompt = payload.mode === "insights"
      ? `Generate portfolio-demo quality insights from:\n${payload.dataSummary}`
      : `Dataset summary:\n${payload.dataSummary}\n\nQuestion: ${payload.question ?? ""}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-8b-instruct:free",
        messages: [{ role: "system", content: system }, ...(payload.history ?? []), { role: "user", content: prompt }]
      })
    });

    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? "No AI response.";
  }

  async function handleUpload(file: File) {
    setError(null);

    const parsed = await new Promise<Papa.ParseResult<Row>>((resolve) => {
      Papa.parse<Row>(file, { header: true, skipEmptyLines: true, complete: resolve });
    });

    const data = parsed.data;
    if (!template) return;
    if (!data.length) return setError("CSV is empty.");
    if (data.length > 100000) return setError("Row count exceeds 100,000.");

    const cols = Object.keys(data[0] ?? {});
    const missing = template.requiredColumns.filter((c) => !cols.includes(c));
    if (missing.length) return setError(`Missing required columns: ${missing.join(", ")}`);

    if (template.requiredColumns.includes("Date") && Number.isNaN(new Date(String(data[0].Date)).getTime())) {
      return setError("Date column contains invalid values.");
    }

    setRows(data);

    if (supabase) {
      await supabase.from("uploaded_records").insert(data.slice(0, 5000).map((r) => ({ industry, template_id: template.id, payload: r })));
    }

    const valKey = Object.keys(data[0]).find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr" || k.toLowerCase() === "price") || "Revenue";
    const total = data.reduce((a, r) => a + Number(r[valKey] ?? 0), 0);
    const summary = JSON.stringify({ industry, template: template.name, rowCount: data.length, total, sampleRows: data.slice(0, 12) }, null, 2);

    setLoadingAI(true);
    try {
      const text = await callOpenRouter({ mode: "insights", dataSummary: summary });
      setInsights(text);
    } catch {
      setInsights(buildDemoInsights(industry, topSegments, total, data.length));
    } finally {
      setLoadingAI(false);
    }
  }

  async function ask() {
    if (!question.trim() || !rows.length) return;
    const q = question;
    const next = [...chat, { role: "user" as const, content: q }];
    setChat(next);
    setQuestion("");

    const summary = `Industry:${industry}\nTemplate:${template?.name}\nRows:${rows.length}\nTop:${JSON.stringify(topSegments)}`;
    try {
      const text = await callOpenRouter({ mode: "chat", dataSummary: summary, question: q, history: next });
      setChat([...next, { role: "assistant", content: text }]);
    } catch {
      setChat([...next, { role: "assistant", content: demoChat(q, trend, topSegments) }]);
    }
  }

  return (
    <main className="shell analyzer-shell">
      <header className="hero-v2">
        <div>
          <p className="eyebrow">Portfolio Demo</p>
          <h1>Industry Intelligence Studio</h1>
          <p>From raw CSV to executive-ready dashboard in minutes.</p>
        </div>
        <div className="hero-kpis">
          <div><span>Rows</span><strong>{stats?.rowCount.toLocaleString() ?? "-"}</strong></div>
          <div><span>Total</span><strong>{stats?.total.toLocaleString() ?? "-"}</strong></div>
          <div><span>Range</span><strong>{stats ? `${stats.minDate} to ${stats.maxDate}` : "-"}</strong></div>
        </div>
      </header>

      <section className="panel control-row">
        <div>
          <h2>AI Engine</h2>
          <p className="hint">AI auto-uses `NEXT_PUBLIC_OPENROUTER_API_KEY` when set at build time.</p>
        </div>
        <input type="password" placeholder="Optional override key" value={openRouterKey} onChange={(e) => setOpenRouterKey(e.target.value)} />
      </section>

      <section className="panel">
        <h2>1. Industry</h2>
        <div className="chip-grid">{industries.map((name) => <button key={name} className={industry === name ? "chip active" : "chip"} onClick={() => { setIndustry(name); setTemplate(null); setRows([]); setChat([]); }}>{name}</button>)}</div>
      </section>

      {industry && (
        <section className="panel">
          <h2>2. Template</h2>
          <div className="template-grid">{templatesByIndustry[industry].map((t) => <button key={t.id} className={template?.id === t.id ? "template-card active" : "template-card"} onClick={() => setTemplate(t)}><strong>{t.name}</strong><span>{t.requiredColumns.join(" • ")}</span></button>)}</div>
          {template && (
            <div className="template-actions">
              <div className="action-row">
                <button className="btn" onClick={() => download(`${template.id}-template.csv`, toCsv(template.sampleRows.length ? template.sampleRows : [Object.fromEntries(template.requiredColumns.map((c) => [c, ""]))]))}>Download Template</button>
                <a className="btn ghost" href={normalizeFilePath(template.sampleFile)} download>Download Repo Sample CSV</a>
              </div>
            </div>
          )}
        </section>
      )}

      {template && (
        <section className="panel">
          <h2>3. Upload</h2>
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          {error && <p className="error">{error}</p>}
          {!!rows.length && (
            <div className="table-wrap"><table><thead><tr>{Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead><tbody>{rows.slice(0, 10).map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody></table></div>
          )}
        </section>
      )}

      {!!rows.length && (
        <section className="panel">
          <div className="viz-head">
            <h2>4. Visualizations</h2>
            <div className="viz-controls">
              <label>Top N <input type="range" min={3} max={10} value={topN} onChange={(e) => setTopN(Number(e.target.value))} /> {topN}</label>
              <label>Focus
                <select value={focusSegment} onChange={(e) => setFocusSegment(e.target.value)}>
                  {segments.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="toggle">
                <button className={chartMode === "bar" ? "chip active" : "chip"} onClick={() => setChartMode("bar")}>Bar</button>
                <button className={chartMode === "area" ? "chip active" : "chip"} onClick={() => setChartMode("area")}>Area</button>
              </div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart">
              <h3>Revenue by Segment</h3>
              <ResponsiveContainer width="100%" height={280}>
                {chartMode === "bar" ? (
                  <BarChart data={topSegments}><CartesianGrid strokeDasharray="2 4" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" radius={[8, 8, 0, 0]}>{topSegments.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Bar></BarChart>
                ) : (
                  <AreaChart data={topSegments}><defs><linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.45} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="2 4" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#gradA)" strokeWidth={3} /></AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="chart">
              <h3>Volume Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}><CartesianGrid strokeDasharray="2 4" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart">
              <h3>Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart><Pie data={shareData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={52}>{shareData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart">
              <h3>Top Segments</h3>
              <ol>{topSegments.map((d) => <li key={d.name}>{d.name}: {d.value.toLocaleString()}</li>)}</ol>
            </div>
          </div>
        </section>
      )}

      {!!rows.length && (
        <section className="panel split">
          <div>
            <h2>5. Insights</h2>
            <pre className="insights">{loadingAI ? "Generating insights..." : insights}</pre>
          </div>
          <div>
            <h2>6. Chat Analyst</h2>
            <div className="chatbox">{chat.map((m, i) => <p key={i}><strong>{m.role === "user" ? "You" : "AI"}:</strong> {m.content}</p>)}</div>
            <div className="chatinput"><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask: Which segment should we expand?" /><button className="btn" onClick={ask}>Send</button></div>
          </div>
        </section>
      )}
    </main>
  );
}

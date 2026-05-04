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

export default function AnalyzerPage() {
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [template, setTemplate] = useState<TemplateDef | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState("Insights will appear after valid upload.");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const dateKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("date")) || "Date";
    const revKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr") || "Revenue";
    const dates = rows.map((r) => new Date(String(r[dateKey]))).filter((d) => !Number.isNaN(d.getTime()));
    const revenue = rows.reduce((acc, r) => acc + Number(r[revKey] ?? 0), 0);
    return {
      rowCount: rows.length,
      minDate: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : "N/A",
      maxDate: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : "N/A",
      revenue
    };
  }, [rows]);

  const departmentRevenue = useMemo(() => {
    if (!rows.length) return [] as { name: string; value: number }[];
    const depKey = Object.keys(rows[0]).find((k) => ["department", "category", "store", "channel", "line", "location"].includes(k.toLowerCase())) || "Department";
    const revKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("revenue") || k.toLowerCase() === "mrr") || "Revenue";
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = String(r[depKey] ?? "Unknown");
      map.set(key, (map.get(key) ?? 0) + Number(r[revKey] ?? 0));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const trend = useMemo(() => {
    if (!rows.length) return [] as { date: string; value: number }[];
    const dateKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("date")) || "Date";
    const valKey = Object.keys(rows[0]).find((k) => ["patient count", "order count", "orders", "new customers", "output", "units"].includes(k.toLowerCase())) || "Patient Count";
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = String(r[dateKey]).slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Number(r[valKey] ?? 0));
    }
    return [...map.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const pieData = useMemo(() => departmentRevenue.slice(0, 6), [departmentRevenue]);

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
      await supabase.from("uploaded_records").insert(
        data.slice(0, 5000).map((r) => ({ industry, template_id: template.id, payload: r }))
      );
    }

    const summary = JSON.stringify(
      {
        industry,
        template: template.name,
        rowCount: data.length,
        topDepartments: departmentRevenue.slice(0, 5),
        sampleRows: data.slice(0, 10)
      },
      null,
      2
    );

    setLoadingAI(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "insights", dataSummary: summary })
      });
      const json = await res.json();
      setInsights(json.text || "Could not generate insights.");
    } catch {
      setInsights("Failed to generate insights. Check API key and network.");
    } finally {
      setLoadingAI(false);
    }
  }

  async function ask() {
    if (!question.trim() || !rows.length) return;
    const next = [...chat, { role: "user" as const, content: question }];
    setChat(next);
    setQuestion("");

    const summary = `Industry: ${industry}\nTemplate: ${template?.name}\nRows: ${rows.length}\nTop segments: ${JSON.stringify(departmentRevenue.slice(0, 5))}`;

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "chat", dataSummary: summary, question, history: next })
    });
    const json = await res.json();
    setChat([...next, { role: "assistant", content: json.text || "No response" }]);
  }

  return (
    <main className="shell">
      <h1>Business Data Analyzer</h1>

      <section className="panel">
        <h2>1. Select Industry</h2>
        <div className="grid seven">
          {industries.map((name) => (
            <button key={name} className={industry === name ? "btn active" : "btn"} onClick={() => { setIndustry(name); setTemplate(null); setRows([]); }}>
              {name}
            </button>
          ))}
        </div>
      </section>

      {industry && (
        <section className="panel">
          <h2>2. Select Template</h2>
          <div className="grid three">
            {templatesByIndustry[industry].map((t) => (
              <button key={t.id} className={template?.id === t.id ? "card active" : "card"} onClick={() => setTemplate(t)}>
                {t.name}
              </button>
            ))}
          </div>

          {template && (
            <div className="subpanel">
              <p><strong>Expected columns:</strong> {template.requiredColumns.join(", ")}</p>
              <button className="btn" onClick={() => download(`${template.id}-template.csv`, toCsv(template.sampleRows.length ? template.sampleRows : [Object.fromEntries(template.requiredColumns.map((c) => [c, ""]))]))}>
                Download CSV Template
              </button>
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
            <div className="stats">
              <p>Rows: {stats.rowCount}</p>
              <p>Date Range: {stats.minDate} to {stats.maxDate}</p>
              <p>Revenue Total: {stats.revenue.toLocaleString()}</p>
            </div>
          )}
          {!!rows.length && (
            <div className="table-wrap">
              <table>
                <thead><tr>{Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
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
          <h2>4. Auto-Generated Visualizations</h2>
          <div className="grid two">
            <div className="chart"><h3>Revenue by Segment</h3><ResponsiveContainer width="100%" height={260}><BarChart data={departmentRevenue}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#4f46e5" /></BarChart></ResponsiveContainer></div>
            <div className="chart"><h3>Volume Trend</h3><ResponsiveContainer width="100%" height={260}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
            <div className="chart"><h3>Distribution</h3><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>{pieData.map((_, index) => <Cell key={index} fill={["#2563eb", "#14b8a6", "#f97316", "#84cc16", "#ec4899", "#6366f1"][index % 6]} />)}</Pie></PieChart></ResponsiveContainer></div>
            <div className="chart"><h3>Top 5 by Revenue</h3><ol>{departmentRevenue.slice(0, 5).map((d) => <li key={d.name}>{d.name}: {d.value.toLocaleString()}</li>)}</ol></div>
          </div>
        </section>
      )}

      {!!rows.length && (
        <section className="panel">
          <h2>5. AI-Generated Insights</h2>
          <pre className="insights">{loadingAI ? "Generating insights..." : insights}</pre>
        </section>
      )}

      {!!rows.length && (
        <section className="panel">
          <h2>6. Interactive AI Chatbot</h2>
          <div className="chatbox">
            {chat.map((m, idx) => <p key={idx}><strong>{m.role === "user" ? "You" : "AI"}:</strong> {m.content}</p>)}
          </div>
          <div className="chatinput">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask follow-up questions..." />
            <button className="btn" onClick={ask}>Send</button>
          </div>
        </section>
      )}

      {!!rows.length && (
        <section className="panel">
          <h2>7. Export & Share</h2>
          <div className="grid two">
            <button className="btn" onClick={() => window.print()}>Download as PDF</button>
            <button className="btn" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy Share Link</button>
          </div>
        </section>
      )}
    </main>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell hero">
      <h1>Industry Analyzer Demo</h1>
      <p>Upload business data, get instant dashboards, and ask AI follow-up questions.</p>
      <Link className="btn" href="/analyzer">
        Open Analyzer
      </Link>
    </main>
  );
}

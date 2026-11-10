"use client";

import { useState } from "react";
import Markdown from "react-markdown";

const apiUrl = process.env.NEXT_PUBLIC_FIDDLE_API_URL ?? "http://127.0.0.1:8000";

async function post(path, body) {
  let response;
  try {
    response = await fetch(new URL(path, apiUrl), { method: "POST", body });
  } catch {
    throw new Error("Could not reach Fiddle. Check that the FastAPI server is running.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" && response.status < 500
      ? data.detail : `Fiddle could not complete this request (HTTP ${response.status}).`);
  }
  return data;
}

export default function PracticePage() {
  const [file, setFile] = useState(null);
  const [score, setScore] = useState(null);
  const [tips, setTips] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  function selectFile(event) {
    setFile(event.target.files[0] ?? null);
    setScore(null);
    setTips("");
    setError("");
  }

  async function upload(event) {
    event.preventDefault();
    if (!file || busy) return;
    if (file.size > 15 * 1024 * 1024) {
      setError("Choose a PDF up to 15 MB.");
      return;
    }
    setBusy("upload");
    setError("");
    setTips("");
    const body = new FormData();
    body.append("file", file);
    try {
      setScore(await post("/upload", body));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(null);
    }
  }

  async function generateTips() {
    if (!score || busy) return;
    setBusy("tips");
    setError("");
    try {
      const result = await post(`/practice-tips/${encodeURIComponent(score.file_id)}`);
      setTips(result.practice_tips || "No specific practice tips were returned.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="site-width">
      <p className="eyebrow">VIOLIN PRACTICE</p>
      <h1>Practice Studio</h1>
      <p>Bring your score and get focused practice tips.</p>
      <form className="panel upload-form" onSubmit={upload}>
        <label htmlFor="score">Sheet music PDF · up to 15 MB</label>
        <input id="score" type="file" accept=".pdf,application/pdf" onChange={selectFile} disabled={Boolean(busy)} required />
        <button className="primary-button" disabled={!file || Boolean(busy)}>{busy === "upload" ? "Uploading…" : "Upload score"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="workspace">
        <section className="panel" aria-labelledby="score-title">
          <h2 id="score-title">Score preview</h2>
          {score ? <><p>{file.name} · {score.page_count} {score.page_count === 1 ? "page" : "pages"}</p><a href={new URL(`/files/${encodeURIComponent(score.file_id)}.pdf`, apiUrl).href}>Open PDF ↗</a><img className="score-preview" src={new URL(score.preview_url, apiUrl).href} alt="First page of your uploaded score" /></> : <p>Upload a PDF to see the first page here.</p>}
        </section>
        <section className="panel" aria-labelledby="tips-title" aria-busy={busy === "tips"}>
          <h2 id="tips-title">Practice tips</h2>
          <p>Get suggestions for passages near the beginning of your score.</p>
          <button className="primary-button" type="button" disabled={!score || Boolean(busy)} onClick={generateTips}>{busy === "tips" ? "Generating tips…" : tips ? "Generate tips again" : "Generate practice tips"}</button>
          {busy === "tips" && <p role="status">Reading the notation and generating advice…</p>}
          {tips && <div className="tips"><Markdown>{tips}</Markdown></div>}
        </section>
      </div>
    </main>
  );
}

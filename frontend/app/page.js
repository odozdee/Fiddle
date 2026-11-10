import Link from "next/link";

export default function Home() {
  return (
    <main>
      <p className="eyebrow">VIOLIN PRACTICE</p>
      <h1>Fiddle</h1>
      <p>Upload your sheet music, read the score, and find passages to practice.</p>
      <Link className="primary-button" href="/practice">Open Practice Studio ↗</Link>
    </main>
  );
}

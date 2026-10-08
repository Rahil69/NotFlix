import Link from "next/link";

export default function NotFound() {
  return (
    <main className="watch-not-found">
      <span>404</span>
      <h1>This title could not be found</h1>
      <p>It may have moved, or the title details are temporarily unavailable.</p>
      <Link className="primary-button" href="/">Back to discover</Link>
    </main>
  );
}

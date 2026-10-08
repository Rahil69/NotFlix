"use client";

export default function ErrorPage({ reset }) {
  return (
    <main className="watch-not-found">
      <span>FLIXNOTMV</span>
      <h1>Something went wrong</h1>
      <p>We couldn't load this page. Try again in a moment.</p>
      <button className="primary-button" onClick={() => reset()}>Try again</button>
    </main>
  );
}

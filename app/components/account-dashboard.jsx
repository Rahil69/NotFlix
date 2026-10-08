"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

function watchHref(item) {
  const path = `/watch/${item.mediaType}/${item.tmdbId}`;
  if (item.mediaType !== "tv" || !item.seasonNumber || !item.episodeNumber) return path;
  return `${path}?season=${item.seasonNumber}&episode=${item.episodeNumber}`;
}

function dateLabel(timestamp) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

function AccountHeader({ user, onSignOut, signingOut }) {
  return (
    <header className="account-header">
      <div className="account-header-inner">
        <Link className="brand" href="/" aria-label="FlixNotMV home">
          <span className="brand-mark"><span aria-hidden="true">▶</span></span>
          <span>FlixNot<span className="brand-accent">MV</span></span>
        </Link>
        <nav className="account-nav" aria-label="Account navigation">
          <Link href="/">Discover</Link>
          <span aria-current="page">My library</span>
        </nav>
        <div className="account-user">
          {user && <>
            <span className="account-avatar" aria-hidden="true">{user.email?.charAt(0).toUpperCase() || "A"}</span>
            <span className="account-email">{user.email}</span>
            <button className="account-signout" type="button" onClick={onSignOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
          </>}
          {!user && <Link className="account-signin" href="/login?next=%2Faccount">Sign in</Link>}
        </div>
      </div>
    </header>
  );
}

function HistoryCard({ item, onRemove, isRemoving = false, priority = false }) {
  const episodeLabel = item.mediaType === "tv" && item.seasonNumber
    ? `Season ${item.seasonNumber} · Episode ${item.episodeNumber}`
    : item.mediaType === "tv" ? "TV series" : "Movie";
  const remainingLabel = item.durationSeconds > 0
    ? `${Math.max(0, Math.ceil((item.durationSeconds - item.positionSeconds) / 60))} min left`
    : "In progress";

  return (
    <article className="history-card">
      <Link className="history-poster" href={watchHref(item)} aria-label={`Continue watching ${item.title}`}>
        {item.posterPath
          ? <Image src={`${IMAGE_BASE_URL}${item.posterPath}`} alt={`${item.title} poster`} fill sizes="(max-width: 600px) 92px, 150px" loading={priority ? "eager" : "lazy"} />
          : <span aria-hidden="true">FM</span>}
        <span className="history-play" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
      </Link>
      <div className="history-card-content">
        <div className="history-card-heading">
          <div>
            <span className="account-item-kicker">{item.mediaType === "tv" ? "TV SERIES" : "MOVIE"}</span>
            <h2>{item.title}</h2>
            <p>{episodeLabel}</p>
          </div>
          <span className="history-percent">{item.progressPercent}%</span>
        </div>
        <div className="history-progress" role="progressbar" aria-label={`${item.title} playback progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progressPercent}>
          <span style={{ width: `${item.progressPercent}%` }} />
        </div>
        <div className="history-card-details"><span>{remainingLabel}</span><span>Last watched {dateLabel(item.updatedAt)}</span></div>
        <div className="history-card-footer">
          <div className="history-card-actions">
            <Link className="history-continue" href={watchHref(item)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>Continue watching<span aria-hidden="true">→</span></Link>
            {onRemove && <button type="button" onClick={() => onRemove(item)} disabled={isRemoving} aria-label={`Remove ${item.title} and its saved progress`} title="Remove this title and its saved progress">
              {isRemoving ? "Removing…" : "Remove"}
            </button>}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function AccountDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [removingTitle, setRemovingTitle] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then(async (data) => {
        if (!data.user) {
          setStatus("signed-out");
          return;
        }
        setUser(data.user);
        const historyResponse = await fetch("/api/history", { cache: "no-store", signal: controller.signal });
        const historyData = await historyResponse.json();
        if (!historyResponse.ok) throw new Error(historyData.error || "Could not load your watch history.");
        setItems(historyData.items || []);
        setStatus("ready");
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Could not load your account.");
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, []);

  const continueItems = useMemo(() => {
    const latestByTitle = new Map();
    items.forEach((item) => {
      const key = `${item.mediaType}-${item.tmdbId}`;
      const existing = latestByTitle.get(key);
      if (!existing || existing.updatedAt < item.updatedAt) latestByTitle.set(key, item);
    });
    return [...latestByTitle.values()]
      .filter((item) => !item.completed)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [items]);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  async function removeTitle(item) {
    const titleKey = `${item.mediaType}-${item.tmdbId}`;
    setRemovingTitle(titleKey);
    setError("");
    try {
      const params = new URLSearchParams({ mediaType: item.mediaType, tmdbId: String(item.tmdbId) });
      const response = await fetch(`/api/history?${params}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove this title.");
      setItems((current) => current.filter((entry) => !(entry.mediaType === item.mediaType && entry.tmdbId === item.tmdbId)));
    } catch (requestError) {
      setError(requestError.message || "Could not remove this title.");
    } finally {
      setRemovingTitle("");
    }
  }

  if (status === "loading") {
    return <main className="account-page"><AccountHeader /><div className="account-content account-content-state"><div className="account-loading"><span className="player-spinner" /><p>Loading your library…</p></div></div></main>;
  }

  if (status === "signed-out") {
    return (
      <main className="account-page">
        <AccountHeader />
        <div className="account-content account-content-state">
          <section className="account-state">
            <span className="account-kicker">YOUR PERSONAL LIBRARY</span>
            <h1>Your next watch is waiting.</h1>
            <p>Sign in to pick up right where you left off.</p>
            <Link className="account-primary-link" href="/login?next=%2Faccount">Sign in to your account <span aria-hidden="true">→</span></Link>
          </section>
        </div>
      </main>
    );
  }

  if (status === "error" && !user) {
    return (
      <main className="account-page">
        <AccountHeader />
        <div className="account-content account-content-state">
          <section className="account-state">
            <span className="account-kicker">YOUR PERSONAL LIBRARY</span>
            <h1>We couldn’t load your account.</h1>
            <p>{error || "Please check your connection and try again."}</p>
            <button className="account-primary-link" type="button" onClick={() => window.location.reload()}>Try again <span aria-hidden="true">↻</span></button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="account-page">
      <AccountHeader user={user} onSignOut={signOut} signingOut={signingOut} />
      <div className="account-content">
        <div className="account-intro">
          <h1>Pick up where you left off.</h1>
          <p>Your saved progress is ready whenever you are.</p>
        </div>

        <section className="account-section" aria-labelledby="continue-heading">
          <div className="account-section-heading">
            <div className="account-section-heading-copy"><h2 id="continue-heading">Continue watching</h2><p>Resume from your last saved moment.</p></div>
            <span className="account-count-pill">{continueItems.length} {continueItems.length === 1 ? "title" : "titles"}</span>
          </div>
          {status === "error" ? <div className="account-empty account-empty-error"><div className="account-error-copy"><span className="account-section-kicker">TEMPORARY ISSUE</span><h3>Your library couldn’t load</h3><p>{error || "Please try again."}</p></div><button type="button" onClick={() => window.location.reload()}>Try again</button></div> : continueItems.length ? <div className="history-list">{continueItems.map((item, index) => {
            const titleKey = `${item.mediaType}-${item.tmdbId}`;
            return <HistoryCard key={titleKey} item={item} onRemove={removeTitle} isRemoving={removingTitle === titleKey} priority={index === 0} />;
          })}</div> : <div className="account-empty"><div className="account-empty-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg></div><div><span className="account-section-kicker">YOUR QUEUE IS CLEAR</span><h3>Nothing in progress yet</h3><p>Start watching a title and it’ll be saved here for next time.</p></div><Link className="account-primary-link" href="/">Explore titles <span aria-hidden="true">→</span></Link></div>}
        </section>

        <footer className="account-footer">
          <Link className="account-back-link" href="/"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m7 7-7-7 7-7" /></svg>Browse titles</Link>
        </footer>
      </div>
    </main>
  );
}

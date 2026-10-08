"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

function PlayIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}

function BackIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
}

function StarIcon() {
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></svg>;
}

function Brand() {
  return <Link className="watch-brand" href="/"><span className="watch-brand-mark"><PlayIcon /></span><span>FlixNot<span>MV</span></span></Link>;
}

export default function WatchExperience({ id, mediaType, initialSeason = 1, initialEpisode = 1 }) {
  const isShow = mediaType === "tv";
  const [title, setTitle] = useState(null);
  const [titleError, setTitleError] = useState(false);
  const [seasonNumber, setSeasonNumber] = useState(initialSeason);
  const [episodeNumber, setEpisodeNumber] = useState(initialEpisode);
  const [episodeData, setEpisodeData] = useState({ key: "", items: [] });
  const [frameLoadedKey, setFrameLoadedKey] = useState("");
  const [slowFrame, setSlowFrame] = useState({ key: "", value: false });
  const [playerRetry, setPlayerRetry] = useState(0);
  const [resumeState, setResumeState] = useState({ key: "", seconds: 0 });
  const [accountStatus, setAccountStatus] = useState("checking");
  const [progressSync, setProgressSync] = useState("idle");
  const iframeRef = useRef(null);
  const episodeKey = `${id}-${seasonNumber}`;
  const episodes = episodeData.key === episodeKey ? episodeData.items : [];
  const seasons = title?.seasons || [];
  const isLoadingEpisodes = isShow && (!title || episodeData.key !== episodeKey);
  const titleName = title?.name || (titleError ? "Title details unavailable" : "Loading title details…");
  const playbackKey = `${mediaType}-${id}-${isShow ? `${seasonNumber}-${episodeNumber}` : "movie"}`;
  const resumeSeconds = resumeState.key === playbackKey ? resumeState.seconds : 0;
  const resumeReady = resumeState.key === playbackKey;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tmdb/${mediaType}/${id}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.status_message || "Could not load title details.");
        return data;
      })
      .then((data) => {
        const availableSeasons = (data.seasons || []).filter((season) => season.season_number > 0);
        const nextTitle = {
          name: data.title || data.name || "Untitled",
          year: data.release_date?.slice(0, 4) || data.first_air_date?.slice(0, 4),
          overview: data.overview || "",
          rating: data.vote_average || 0,
          genres: data.genres || [],
          posterPath: data.poster_path || null,
          posterUrl: data.poster_path ? `${IMAGE_BASE_URL}w500${data.poster_path}` : null,
          backdropUrl: data.backdrop_path ? `${IMAGE_BASE_URL}w1280${data.backdrop_path}` : null,
          seasons: availableSeasons,
        };
        setTitle(nextTitle);
        if (isShow) {
          const chosenSeason = availableSeasons.some((season) => season.season_number === initialSeason)
            ? initialSeason
            : availableSeasons[0]?.season_number ?? 1;
          setSeasonNumber(chosenSeason);
        }
        document.title = `${nextTitle.name} | FlixNotMV`;
      })
      .catch((error) => {
        if (error.name !== "AbortError") setTitleError(true);
      });
    return () => controller.abort();
  }, [id, initialSeason, isShow, mediaType]);

  useEffect(() => {
    if (!isShow || !title || !seasonNumber) return undefined;
    const controller = new AbortController();
    fetch(`/api/tmdb/tv/${id}/season/${seasonNumber}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.status_message || "Could not load episodes.");
        return data;
      })
      .then((data) => {
        const items = data.episodes || [];
        setEpisodeData({ key: episodeKey, items });
        setEpisodeNumber((current) => items.some((episode) => episode.episode_number === current)
          ? current
          : items[0]?.episode_number ?? 1);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setEpisodeData({ key: episodeKey, items: [] });
      });
    return () => controller.abort();
  }, [episodeKey, id, isShow, seasonNumber, title]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ tmdbId: String(id), mediaType });
    if (isShow) {
      params.set("seasonNumber", String(seasonNumber));
      params.set("episodeNumber", String(episodeNumber));
    }
    fetch(`/api/history?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return { item: null };
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load saved playback position.");
        return data;
      })
      .then((data) => setResumeState({ key: playbackKey, seconds: data.item?.resumeSeconds || 0 }))
      .catch((error) => {
        if (error.name !== "AbortError") setResumeState({ key: playbackKey, seconds: 0 });
      });
    return () => controller.abort();
  }, [episodeNumber, id, isShow, mediaType, playbackKey, seasonNumber]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const nextStatus = data.user ? "signed-in" : "signed-out";
        setAccountStatus(nextStatus);
        setProgressSync(nextStatus === "signed-in" ? "waiting" : "idle");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setAccountStatus("signed-out");
          setProgressSync("idle");
        }
      });
    return () => controller.abort();
  }, []);

  const playerUrl = useMemo(() => {
    const baseUrl = isShow
      ? `https://vidsrc.sh/embed/tv?tmdb=${id}&season=${seasonNumber}&episode=${episodeNumber}`
      : `https://vidsrc.sh/embed/movie?tmdb=${id}`;
    return resumeSeconds >= 5 ? `${baseUrl}&startAt=${Math.floor(resumeSeconds)}` : baseUrl;
  }, [episodeNumber, id, isShow, resumeSeconds, seasonNumber]);
  const iframeKey = `${playerUrl}-${playerRetry}`;
  const isIframeLoading = !resumeReady || frameLoadedKey !== iframeKey;
  const showSlowNotice = slowFrame.key === iframeKey && slowFrame.value;

  useEffect(() => {
    if (!isIframeLoading) return undefined;
    const timeoutId = setTimeout(() => setSlowFrame({ key: iframeKey, value: true }), 12000);
    return () => clearTimeout(timeoutId);
  }, [iframeKey, isIframeLoading]);

  useEffect(() => {
    if (!title || accountStatus !== "signed-in") return undefined;

    function handlePlayerMessage(event) {
      if (event.origin !== "https://vidsrc.sh" || event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data;
      const data = message?.type === "PLAYER_EVENT" ? message.data : null;
      const info = data?.player_info;
      if (!info || !["playing", "paused", "seeked", "completed"].includes(data.player_status)) return;
      if (info.mediaType !== mediaType || (info.tmdb && String(info.tmdb) !== String(id))) return;

      const eventSeason = Number(info.season) || seasonNumber;
      const eventEpisode = Number(info.episode) || episodeNumber;
      if (isShow && (eventSeason !== seasonNumber || eventEpisode !== episodeNumber)) return;

      const positionSeconds = Number(data.player_progress);
      const durationSeconds = Number(data.player_duration);
      if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return;

      setProgressSync("saving");
      fetch("/api/history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: id,
          mediaType,
          title: title.name,
          posterPath: title.posterPath,
          seasonNumber: isShow ? eventSeason : null,
          episodeNumber: isShow ? eventEpisode : null,
          positionSeconds,
          durationSeconds,
          status: data.player_status,
        }),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not save playback progress.");
        setProgressSync("saved");
      }).catch(() => setProgressSync("error"));
    }

    window.addEventListener("message", handlePlayerMessage);
    return () => window.removeEventListener("message", handlePlayerMessage);
  }, [accountStatus, episodeNumber, id, isShow, mediaType, seasonNumber, title]);

  function stepEpisode(direction) {
    const currentIndex = episodes.findIndex((episode) => episode.episode_number === episodeNumber);
    const nextEpisode = episodes[currentIndex + direction];
    if (nextEpisode) setEpisodeNumber(nextEpisode.episode_number);
  }

  const watchReturnPath = `/watch/${mediaType}/${id}${isShow ? `?season=${seasonNumber}&episode=${episodeNumber}` : ""}`;
  const signInHref = `/login?next=${encodeURIComponent(watchReturnPath)}`;

  return (
    <main className="watch-page">
      <a className="skip-link" href="#watch-content">Skip to player</a>
      {title?.backdropUrl && <div className="watch-backdrop"><Image src={title.backdropUrl} alt="" fill priority sizes="100vw" /></div>}
      <header className="watch-header">
        <Link className="watch-back-link" href="/" aria-label="Back to discover"><BackIcon /><span>Discover</span></Link>
        <Brand />
        <span className="watch-header-label">NOW SHOWING</span>
      </header>

      <div className="watch-content" id="watch-content">
        <div className="watch-page-title">
          <div className="watch-title-copy">
            <div className="watch-eyebrow"><span /> {isShow ? "SERIES" : "FEATURE PRESENTATION"}</div>
            <h1>{titleName}</h1>
            <div className="watch-title-meta">
              {title?.year && <span>{title.year}</span>}
              {title?.rating > 0 && <span className="watch-rating"><StarIcon /> {title.rating.toFixed(1)}</span>}
              {title?.genres.slice(0, 3).map((genre) => <span className="watch-genre" key={genre.id}>{genre.name}</span>)}
            </div>
          </div>
          {isShow && <span className="watch-series-tag">TV SERIES</span>}
        </div>

        <div className="watch-layout">
          <section className="watch-main-column" aria-label="Video player">
            <div className="watch-player-card">
              <div className="player-toolbar">
                <span className="player-brand"><span className="player-status" /> FLIXNOTMV PLAYER</span>
                {isShow && <span className="playing-episode">S{String(seasonNumber).padStart(2, "0")} · E{String(episodeNumber).padStart(2, "0")}</span>}
                {!isShow && <span className="playing-episode">FEATURE PRESENTATION</span>}
              </div>
              <div className="watch-frame">
                {resumeReady && <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    src={playerUrl}
                    title={`Video player for ${titleName}${isShow ? ` season ${seasonNumber} episode ${episodeNumber}` : ""}`}
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    onLoad={() => setFrameLoadedKey(iframeKey)}
                  />}
                {isIframeLoading && <div className="player-loading" role="status">
                  <span className="player-spinner" />
                  <span>{showSlowNotice ? "The video source is taking longer than usual." : "Connecting to video source…"}</span>
                  {showSlowNotice && <button type="button" onClick={() => { setFrameLoadedKey(""); setPlayerRetry((retry) => retry + 1); }}>Reload player</button>}
                </div>}
              </div>
              <div className="player-bottom-bar">
                <span>Enjoy the show</span>
                <span>{accountStatus === "signed-in"
                  ? progressSync === "saved"
                    ? "Playback progress saved to your account"
                    : progressSync === "saving"
                      ? "Saving playback progress…"
                      : progressSync === "error"
                        ? "Could not save progress. Check your connection and account."
                        : "Waiting for playback updates…"
                  : accountStatus === "signed-out"
                    ? <Link href={signInHref}>Sign in to save your progress</Link>
                    : "Checking account…"}</span>
              </div>
            </div>

            {isShow && (
              <div className="episode-navigation">
                <button type="button" className="episode-step" onClick={() => stepEpisode(-1)} disabled={isLoadingEpisodes || !episodes.length || episodes[0]?.episode_number === episodeNumber}>
                  <span aria-hidden="true">←</span><span>Previous episode</span>
                </button>
                <div className="episode-now"><span>SELECTED EPISODE</span><strong>Season {seasonNumber} <i /> Episode {episodeNumber}</strong></div>
                <button type="button" className="episode-step next" onClick={() => stepEpisode(1)} disabled={isLoadingEpisodes || !episodes.length || episodes.at(-1)?.episode_number === episodeNumber}>
                  <span>Next episode</span><span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </section>

          <aside className="watch-sidebar">
            <section className="watch-info-panel">
              <div className="watch-info-heading"><span>ABOUT THIS TITLE</span><span className="info-rule" /></div>
              <div className="watch-info-title">
                {title?.posterUrl && <div className="watch-poster"><Image src={title.posterUrl} alt={`${title.name} poster`} fill sizes="76px" /></div>}
                <div><h2>{titleName}</h2><p>{isShow ? "Television series" : "Feature film"}{title?.year ? ` · ${title.year}` : ""}</p></div>
              </div>
              <p className="watch-overview">{title?.overview || (titleError ? "Title information is temporarily unavailable." : "Loading title information…")}</p>
              {title?.genres.length > 0 && <div className="watch-genre-list">{title.genres.map((genre) => <span key={genre.id}>{genre.name}</span>)}</div>}
            </section>

            {isShow && (
              <section className="episode-picker" aria-label="Choose a season and episode">
                <div className="watch-info-heading"><span>EPISODES</span><span className="episode-count">{episodes.length ? `${episodes.length} IN SEASON` : ""}</span></div>
                <label className="watch-select-label" htmlFor="season-select">Season</label>
                <select id="season-select" className="watch-select" value={seasonNumber} onChange={(event) => { setSeasonNumber(Number(event.target.value)); setEpisodeNumber(1); }} disabled={!seasons.length}>
                  {seasons.length ? seasons.map((season) => <option key={season.id} value={season.season_number}>{season.name}</option>) : <option>{title ? "No seasons listed" : "Loading seasons…"}</option>}
                </select>
                <label className="watch-select-label" htmlFor="episode-select">Episode</label>
                <select id="episode-select" className="watch-select" value={episodeNumber} onChange={(event) => setEpisodeNumber(Number(event.target.value))} disabled={isLoadingEpisodes || !episodes.length}>
                  {episodes.length ? episodes.map((episode) => <option key={episode.id} value={episode.episode_number}>Episode {String(episode.episode_number).padStart(2, "0")} · {episode.name}</option>) : <option>{isLoadingEpisodes ? "Loading episodes…" : "No episodes available"}</option>}
                </select>
                <p className="episode-help" aria-live="polite">{isLoadingEpisodes ? "Loading this season's episode list…" : episodes.length ? "Choose an episode to start playing." : "Episode information is not available right now."}</p>
              </section>
            )}
          </aside>
        </div>
        <footer className="watch-footer"><Link href="/">← Back to all titles</Link><span>FLIXNOTMV <i /> DISCOVER · WATCH · REPEAT</span></footer>
      </div>
    </main>
  );
}

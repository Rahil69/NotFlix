"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MovieCard from "./movie-card";
import { isAdultTitle } from "../../lib/content-filter";

function endpoint(path, params = {}) {
  const query = new URLSearchParams(params);
  return `/api/tmdb/${path}${query.size ? `?${query}` : ""}`;
}

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function Arrow({ direction }) {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

function ShelfIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h16v12H4z" />
      <path d="m4 8 1.5-4h15L19 8M8 4l2 4m3-4 2 4m3-4 2 4" />
    </svg>
  );
}

function CollectionShelf({ collection }) {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState({ status: "idle", titles: [], error: "" });

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => setShouldLoad(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "450px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return undefined;
    const controller = new AbortController();

    Promise.all(collection.requests.map(async (request) => {
      const response = await fetch(request.url, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.status_message || "Could not load this collection.");
      return (data.results || []).map((title) => ({
        ...title,
        media_type: title.media_type || request.mediaType,
      })).filter((title) => !isAdultTitle(title));
    }))
      .then((resultSets) => {
        const uniqueTitles = new Map();
        resultSets.flat().forEach((title) => uniqueTitles.set(`${title.media_type}-${title.id}`, title));
        const titles = [...uniqueTitles.values()];
        if (collection.sortBy === "date") {
          titles.sort((a, b) => {
            const dateA = a.release_date || a.first_air_date || "";
            const dateB = b.release_date || b.first_air_date || "";
            return dateB.localeCompare(dateA);
          });
        } else if (collection.sortBy === "rating") {
          titles.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } else if (collection.sortBy === "popularity") {
          titles.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }
        setState({ status: "ready", titles: titles.slice(0, 20), error: "" });
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState({ status: "error", titles: [], error: error.message || "Could not load this collection." });
        }
      });

    return () => controller.abort();
  }, [collection, retryKey, shouldLoad]);

  function scroll(direction) {
    trackRef.current?.scrollBy({ left: direction * 520, behavior: "smooth" });
  }

  const safeTitles = state.titles.filter((title) => !isAdultTitle(title));

  return (
    <section className="catalog-section collection-section" ref={sectionRef} aria-labelledby={`collection-${collection.id}`}>
      <div className="section-header">
        <div className="section-title-group">
          <span className="section-icon collection-icon"><ShelfIcon /></span>
          <div>
            <h2 id={`collection-${collection.id}`}>{collection.title}</h2>
            <p className="section-subtitle">{collection.description}</p>
          </div>
        </div>
        <div className="section-controls">
          {state.status === "ready" && <span className="result-count">{safeTitles.length} TITLES</span>}
          <button className="row-arrow" onClick={() => scroll(-1)} aria-label={`Scroll ${collection.title} left`}><Arrow direction="left" /></button>
          <button className="row-arrow" onClick={() => scroll(1)} aria-label={`Scroll ${collection.title} right`}><Arrow direction="right" /></button>
        </div>
      </div>

      {state.status === "error" ? (
        <div className="collection-message" role="status">
          <p>{state.error}</p>
          <button className="text-button" onClick={() => { setState({ status: "loading", titles: [], error: "" }); setRetryKey((key) => key + 1); }}>Try again</button>
        </div>
      ) : state.status !== "ready" ? (
        <ul className="poster-grid" aria-label={`Loading ${collection.title}`}>
          {Array.from({ length: 6 }, (_, index) => <li className="poster-skeleton" key={index}><div /><i /><i /></li>)}
        </ul>
      ) : safeTitles.length ? (
        <ul className="poster-grid" ref={trackRef}>
          {safeTitles.map((title) => <MovieCard key={`${title.media_type}-${title.id}`} movie={title} />)}
        </ul>
      ) : (
        <div className="collection-message"><p>No titles are available for this collection right now.</p></div>
      )}
    </section>
  );
}

export default function HomeCollections() {
  const collections = useMemo(() => {
    const today = new Date();
    const todayKey = dateString(today);
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const recentStart = dateString(yearAgo);
    const discover = (type, params, mediaType = type) => ({
      url: endpoint(`discover/${type}`, params),
      mediaType,
    });
    const genreShelf = (id, title, movieGenre, tvGenre) => ({
      id,
      title,
      description: `Popular ${title.toLowerCase()} picks`,
      sortBy: "popularity",
      requests: [
        discover("movie", { with_genres: movieGenre, sort_by: "popularity.desc" }),
        discover("tv", { with_genres: tvGenre, sort_by: "popularity.desc" }),
      ],
    });
    const languageShelf = (id, title, language) => ({
      id,
      title,
      description: `Popular ${title.toLowerCase()} movies and series`,
      sortBy: "popularity",
      requests: [
        discover("movie", { with_original_language: language, sort_by: "popularity.desc" }),
        discover("tv", { with_original_language: language, sort_by: "popularity.desc" }),
      ],
    });

    return [
      {
        id: "current-tv",
        title: "Current TV Shows",
        description: "Series currently on the air",
        requests: [{ url: endpoint("tv/on_the_air"), mediaType: "tv" }],
      },
      {
        id: "upcoming-tv",
        title: "Upcoming TV Shows",
        description: "Series scheduled to premiere",
        requests: [discover("tv", { "first_air_date.gte": todayKey, sort_by: "first_air_date.asc" })],
      },
      {
        id: "recently-added",
        title: "Recently Added",
        description: "Movies and series released in the past year",
        sortBy: "date",
        requests: [
          discover("movie", { "primary_release_date.gte": recentStart, "primary_release_date.lte": todayKey, sort_by: "primary_release_date.desc" }),
          discover("tv", { "first_air_date.gte": recentStart, "first_air_date.lte": todayKey, sort_by: "first_air_date.desc" }),
        ],
      },
      {
        id: "this-weeks-movies",
        title: "This Week's Movies",
        description: "Movies currently playing in theaters",
        requests: [{ url: endpoint("movie/now_playing"), mediaType: "movie" }],
      },
      {
        id: "trending-movies",
        title: "Trending Movies",
        description: "Movies trending this week",
        requests: [{ url: endpoint("trending/movie/week"), mediaType: "movie" }],
      },
      {
        id: "trending-series",
        title: "Trending Series",
        description: "TV series trending this week",
        requests: [{ url: endpoint("trending/tv/week"), mediaType: "tv" }],
      },
      {
        id: "top-rated",
        title: "Top Rated",
        description: "Highest-rated movies and series",
        sortBy: "rating",
        requests: [
          { url: endpoint("movie/top_rated"), mediaType: "movie" },
          { url: endpoint("tv/top_rated"), mediaType: "tv" },
        ],
      },
      genreShelf("genre-action", "Action", 28, 10759),
      genreShelf("genre-drama", "Drama", 18, 18),
      genreShelf("genre-horror", "Horror", 27, 27),
      languageShelf("language-korean", "Korean", "ko"),
      languageShelf("language-japanese", "Japanese", "ja"),
    ];
  }, []);

  const standardCollections = collections.filter((collection) => collection.id !== "genre-action"
    && collection.id !== "genre-drama"
    && collection.id !== "genre-horror"
    && collection.id !== "language-korean"
    && collection.id !== "language-japanese");
  const genreCollections = collections.filter((collection) => !standardCollections.includes(collection));

  return (
    <div className="home-collections" aria-label="More collections">
      {standardCollections.slice(0, 3).map((collection) => <CollectionShelf collection={collection} key={collection.id} />)}
      {standardCollections.slice(3).map((collection) => <CollectionShelf collection={collection} key={collection.id} />)}
      <div className="collection-group-heading">
          <span className="section-icon collection-icon"><ShelfIcon /></span>
        <div><h2>Popular Genres</h2><p className="section-subtitle">Browse popular movies and series by genre or language</p></div>
      </div>
      {genreCollections.map((collection) => <CollectionShelf collection={collection} key={collection.id} />)}
    </div>
  );
}

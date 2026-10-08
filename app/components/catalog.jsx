"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AccountLink from "./account-link";
import BrandMark from "./brand-mark";
import HomeCollections from "./home-collections";
import MovieCard from "./movie-card";
import { isAdultTitle } from "../../lib/content-filter";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";
const FILTERS = [
  { label: "Popular", id: "popular", description: "Popular movies from TMDB" },
  { label: "Action", id: "action", movieId: 28, tvId: 10759 },
  { label: "Comedy", id: "comedy", movieId: 35, tvId: 35 },
  { label: "Drama", id: "drama", movieId: 18, tvId: 18 },
  { label: "Horror", id: "horror", movieId: 27, tvId: 27 },
  { label: "Animation", id: "animation", movieId: 16, tvId: 16 },
  { label: "Sci-fi", id: "sci-fi", movieId: 878, tvId: 10765 },
];
const GENRES = new Map(FILTERS.flatMap((filter) => [
  [filter.movieId, filter.label],
  [filter.tvId, filter.label],
].filter(([id]) => id)));
GENRES.set(10762, "Kids & Family");

function Icon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    play: <path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none" />,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" fill="currentColor" stroke="none" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    clapper: <><path d="M4 8h16v12H4z" /><path d="m4 8 1.5-4h15L19 8" /><path d="m8 4 2 4m3-4 2 4m3-4 2 4" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="FlixNotMV home">
      <span className="brand-mark"><BrandMark /></span>
      <span>FlixNot<span className="brand-accent">MV</span></span>
    </Link>
  );
}

export default function Catalog({ mode = "home" }) {
  const mediaType = mode === "tv" || mode === "anime" ? "tv" : "movie";
  const activeNav = mode === "home" ? "home" : mode === "movies" ? "movie" : mode;
  const [activeFilter, setActiveFilter] = useState(mode === "home" ? "trending" : mode === "anime" ? "animation" : "popular");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [result, setResult] = useState({ key: "", titles: [], error: "" });
  const titleTrackRef = useRef(null);
  const activeCategory = FILTERS.find((filter) => filter.id === activeFilter) || FILTERS[0];

  const endpoint = useMemo(() => {
    if (query) return `/api/tmdb/search/multi?query=${encodeURIComponent(query)}&include_adult=false`;
    if (activeFilter === "trending") return "/api/tmdb/trending/all/week";
    const category = FILTERS.find((filter) => filter.id === activeFilter) || FILTERS[0];
    const categoryType = category.mediaType === "movie" || category.mediaType === "tv" ? category.mediaType : mediaType;
    if (category.path) return `/api/tmdb/${category.path}`;
    const genreId = categoryType === "movie" ? category.movieId : category.tvId;
    if (genreId) return `/api/tmdb/discover/${categoryType}?with_genres=${encodeURIComponent(genreId)}&sort_by=popularity.desc`;
    return `/api/tmdb/${categoryType}/popular`;
  }, [activeFilter, mediaType, query]);

  const requestKey = `${endpoint}-${refreshKey}`;
  const isLoading = result.key !== requestKey;
  const titles = isLoading ? [] : result.titles.filter((title) => !isAdultTitle(title));
  const error = isLoading ? "" : result.error;
  const featuredTitles = titles.filter((item) => item.backdrop_path);
  const featuredTitle = isLoading
    ? null
    : featuredTitles.length
      ? featuredTitles[featuredIndex % featuredTitles.length]
      : titles[0] || null;

  useEffect(() => {
    const controller = new AbortController();
    const fallbackMediaType = activeCategory.mediaType === "multi" ? "movie" : activeCategory.mediaType || mediaType;
    fetch(endpoint, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(response.status === 401 ? "TMDB could not authenticate. Check the server token in .env." : data.status_message || "Could not load titles. Please try again.");
        }
        return data;
      })
      .then((data) => {
        const items = (data.results || [])
          .filter((item) => (item.media_type || fallbackMediaType) !== "person" && !isAdultTitle(item))
          .map((item) => ({ ...item, media_type: item.media_type || fallbackMediaType }));
        setFeaturedIndex(0);
        setResult({ key: requestKey, titles: items, error: "" });
      })
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setResult({ key: requestKey, titles: [], error: fetchError.message || "Something went wrong while loading titles." });
        }
      });
    return () => controller.abort();
  }, [activeCategory, activeFilter, endpoint, mediaType, requestKey]);

  function handleSearch(event) {
    event.preventDefault();
    setQuery(searchInput.trim());
    setActiveFilter("popular");
  }

  function selectCategory(category) {
    const nextCategory = FILTERS.find((filter) => filter.id === category);
    if (!nextCategory) return;
    setActiveFilter(category);
    setQuery("");
    setSearchInput("");
  }

  function moveFeatured(direction) {
    if (!featuredTitles.length) return;
    setFeaturedIndex((index) => (index + direction + featuredTitles.length) % featuredTitles.length);
  }

  function scrollTitles(direction) {
    titleTrackRef.current?.scrollBy({ left: direction * 520, behavior: "smooth" });
  }

  const year = featuredTitle?.release_date?.slice(0, 4) || featuredTitle?.first_air_date?.slice(0, 4);
  const featuredName = featuredTitle?.title || featuredTitle?.name || "Your next favorite";
  const featuredHref = featuredTitle
    ? `/watch/${featuredTitle.media_type === "tv" ? "tv" : "movie"}/${featuredTitle.id}`
    : "/";
  const featuredGenres = (featuredTitle?.genre_ids || []).map((id) => GENRES.get(id)).filter(Boolean).slice(0, 2);
  const sectionTitle = query
    ? `Results for “${query}”`
    : mode === "home" && activeFilter === "trending"
      ? "Trending This Week"
      : mode === "anime"
        ? "Anime"
        : activeCategory.id === "popular"
          ? mediaType === "tv" ? "Popular Series" : "Popular Movies"
          : activeCategory.label;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#catalog-main">Skip to content</a>
      <header className="site-header">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          <Link className={`nav-link ${activeNav === "home" ? "active" : ""}`} href="/">Home</Link>
          <Link className={`nav-link ${activeNav === "movie" ? "active" : ""}`} href="/movies">Movies</Link>
          <Link className={`nav-link ${activeNav === "tv" ? "active" : ""}`} href="/tv-shows">TV Shows</Link>
          <Link className={`nav-link ${activeNav === "anime" ? "active" : ""}`} href="/anime">Anime</Link>
        </nav>
        <div className="header-actions">
          <AccountLink />
        </div>
      </header>

      <main id="catalog-main">
        {!query && isLoading && (
          <section className="featured featured-placeholder" aria-label="Loading featured title">
            <div className="featured-content hero-loading-content" aria-hidden="true"><span /><span /><span /><span /></div>
          </section>
        )}
        {!query && featuredTitle && (
          <section className="featured" aria-label="Featured title">
            {featuredTitle.backdrop_path && <div className="featured-image-layer" key={featuredTitle.id}><Image src={`${IMAGE_BASE_URL}original${featuredTitle.backdrop_path}`} alt="" fill priority sizes="100vw" /></div>}
            <button className="hero-arrow hero-arrow-left" onClick={() => moveFeatured(-1)} aria-label="Previous featured title"><Icon name="left" size={21} /></button>
            <div className="featured-content">
              <div className="featured-genres">
                {featuredGenres.length ? featuredGenres.map((genre) => <span className="genre-badge" key={genre}>{genre}</span>) : <span className="genre-badge">FEATURED</span>}
              </div>
              <div className="featured-meta">
                <span>{year || "New"}</span>
                {featuredTitle.vote_average > 0 && <span className="rating"><Icon name="star" size={14} /> {featuredTitle.vote_average.toFixed(1)}</span>}
                <span className="type-label">{featuredTitle.media_type === "tv" ? "TV SERIES" : "MOVIE"}</span>
              </div>
              <h1>{featuredName}</h1>
              <p className="featured-overview">{featuredTitle.overview || "A story worth settling in for. Find your next favorite from this collection of films and series."}</p>
              <div className="featured-actions">
                <Link className="primary-button" href={featuredHref}><Icon name="play" size={15} /> Play now</Link>
                <a className="secondary-button" href="#titles">Explore titles</a>
              </div>
            </div>
            <button className="hero-arrow hero-arrow-right" onClick={() => moveFeatured(1)} aria-label="Next featured title"><Icon name="right" size={21} /></button>
            {featuredTitles.length > 1 && <div className="hero-pagination" aria-label={`Featured title ${featuredIndex + 1} of ${featuredTitles.length}`}>{Array.from({ length: Math.min(5, featuredTitles.length) }, (_, index) => <span className={index === featuredIndex % 5 ? "hero-pagination-active" : ""} key={index} />)}</div>}
          </section>
        )}

        <section className="discovery-controls" aria-label="Search and browse">
          <form className="discovery-search" onSubmit={handleSearch} role="search">
            <Icon name="search" size={19} />
            <input id="title-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search movies, series, anime..." aria-label="Search titles" />
            {searchInput && <button type="button" className="clear-search" onClick={() => { setSearchInput(""); setQuery(""); setActiveFilter(mode === "home" ? "trending" : mode === "anime" ? "animation" : "popular"); }} aria-label="Clear search"><Icon name="close" size={16} /></button>}
            <button className="search-submit" type="submit">Search <Icon name="right" size={15} /></button>
          </form>
          {!query && <div className="filter-strip" aria-label="Browse categories">
            {FILTERS.map((filter) => (
              <button key={filter.id} className={`filter-chip ${activeFilter === filter.id ? "active" : ""}`} onClick={() => selectCategory(filter.id)} aria-pressed={activeFilter === filter.id}>{filter.label}</button>
            ))}
          </div>}
        </section>

        <section className="catalog-section" id="titles">
          <div className="section-header">
            <div className="section-title-group">
              <span className="section-icon"><Icon name="clapper" size={16} /></span>
              <div>
                <h2>{sectionTitle}</h2>
                <p className="section-subtitle">{query ? "Matching titles from TMDB" : activeFilter === "trending" ? "Movies and series people are watching this week" : activeCategory.id === "popular" && mediaType === "tv" ? "Popular series from TMDB" : activeCategory.description || "Find something good to watch"}</p>
              </div>
            </div>
            <div className="section-controls">
              <span className="result-count">{isLoading ? "LOADING" : `${titles.length} TITLES`}</span>
              <button className="row-arrow" onClick={() => scrollTitles(-1)} aria-label="Scroll titles left"><Icon name="left" size={17} /></button>
              <button className="row-arrow" onClick={() => scrollTitles(1)} aria-label="Scroll titles right"><Icon name="right" size={17} /></button>
            </div>
          </div>

          {isLoading ? (
            <ul className="poster-grid" aria-label="Loading titles">{Array.from({ length: 6 }, (_, index) => <li className="poster-skeleton" key={index}><div /><i /><i /></li>)}</ul>
          ) : error ? (
            <div className="empty-state"><span className="empty-icon">!</span><h3>Couldn&apos;t load titles</h3><p>{error}</p><button className="primary-button" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></div>
          ) : titles.length ? (
            <ul className="poster-grid" ref={titleTrackRef}>{titles.map((title) => <MovieCard key={`${title.media_type}-${title.id}`} movie={title} />)}</ul>
          ) : (
            <div className="empty-state"><span className="empty-icon">⌕</span><h3>No titles found</h3><p>Try another search or choose a different category.</p><button className="text-button" onClick={() => { setQuery(""); setSearchInput(""); setActiveFilter(mode === "home" ? "trending" : mode === "anime" ? "animation" : "popular"); }}>Show popular titles</button></div>
          )}
        </section>
        {!query && mode === "home" && <HomeCollections />}
      </main>

      <footer className="site-footer"><Brand /><span>Find a story. Settle in.</span><span>DISCOVER · WATCH · REPEAT</span></footer>
    </div>
  );
}

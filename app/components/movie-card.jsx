import Image from "next/image";
import Link from "next/link";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

export default function MovieCard({ movie }) {
  const title = movie.title || movie.name || "Untitled";
  const year = movie.release_date?.slice(0, 4) || movie.first_air_date?.slice(0, 4) || "Date unknown";
  const isShow = movie.media_type === "tv";

  return (
    <li className="title-card">
      <Link className="poster-button" href={`/watch/${isShow ? "tv" : "movie"}/${movie.id}`} aria-label={`Watch ${title}`}>
        <span className="poster-art">
          {movie.poster_path ? (
            <Image
              src={`${IMAGE_BASE_URL}w500${movie.poster_path}`}
              alt={`${title} poster`}
              fill
              sizes="(max-width: 420px) 136px, (max-width: 720px) 142px, (max-width: 1050px) 170px, 190px"
            />
          ) : (
            <span className="poster-fallback"><span>FM</span><small>{title}</small></span>
          )}
          <span className="poster-kind">{isShow ? "SERIES" : "MOVIE"}</span>
          {movie.vote_average > 0 && <span className="poster-rating">★ {movie.vote_average.toFixed(1)}</span>}
          <span className="poster-hover"><span className="poster-play">▶</span><span>PLAY TITLE</span></span>
        </span>
        <span className="card-title">{title}</span>
        <span className="card-meta">{year}<i />{isShow ? "Series" : "Movie"}</span>
      </Link>
    </li>
  );
}

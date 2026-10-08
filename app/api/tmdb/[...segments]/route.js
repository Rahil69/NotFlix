import { NextResponse } from "next/server";
import { requestTmdb } from "../../../../lib/tmdb";
import { isAdultTitle } from "../../../../lib/content-filter";

export const dynamic = "force-dynamic";

const ALLOWED_QUERY_PARAMS = new Set([
  "query",
  "include_adult",
  "with_genres",
  "with_original_language",
  "sort_by",
  "primary_release_date.gte",
  "primary_release_date.lte",
  "first_air_date.gte",
  "first_air_date.lte",
  "page",
  "language",
]);
function isAllowedPath(segments) {
  if (segments.length === 2 && segments[0] === "movie" && ["popular", "top_rated", "now_playing"].includes(segments[1])) return true;
  if (segments.length === 2 && segments[0] === "tv" && ["popular", "top_rated", "on_the_air", "airing_today"].includes(segments[1])) return true;
  if (segments.length === 3 && segments[0] === "trending" && ["all", "movie", "tv"].includes(segments[1]) && ["day", "week"].includes(segments[2])) return true;
  if (segments.length === 2 && segments[0] === "discover" && ["movie", "tv"].includes(segments[1])) return true;
  if (segments.length === 2 && segments[0] === "search" && segments[1] === "multi") return true;
  if (segments.length === 2 && ["movie", "tv"].includes(segments[0]) && /^\d+$/.test(segments[1])) return true;
  return segments.length === 4
    && segments[0] === "tv"
    && /^\d+$/.test(segments[1])
    && segments[2] === "season"
    && /^\d+$/.test(segments[3]);
}

export async function GET(request, context) {
  const { segments = [] } = await context.params;
  if (!isAllowedPath(segments)) {
    return NextResponse.json({ status_message: "TMDB endpoint is not allowed." }, { status: 404 });
  }

  const searchParams = Object.fromEntries(
    [...request.nextUrl.searchParams.entries()].filter(([key]) => ALLOWED_QUERY_PARAMS.has(key)),
  );
  const isSearch = segments[0] === "search";
  if (isSearch || segments[0] === "discover") searchParams.include_adult = "false";

  try {
    const result = await requestTmdb(`/${segments.join("/")}`, searchParams, isSearch ? null : 900);
    if (result.data && Array.isArray(result.data.results)) {
      result.data.results = result.data.results.filter((title) => !isAdultTitle(title));
    } else if (isAdultTitle(result.data)) {
      return NextResponse.json({ status_message: "This title is unavailable." }, { status: 404 });
    }
    const cacheHeaders = { "Cache-Control": "no-store" };
    return NextResponse.json(result.data, {
      status: result.status,
      headers: cacheHeaders,
    });
  } catch {
    return NextResponse.json({ status_message: "TMDB is temporarily unavailable." }, { status: 502 });
  }
}

import "server-only";

const TMDB_API_BASE = "https://api.themoviedb.org/3";

export async function requestTmdb(path, searchParams = {}, revalidate = 900) {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN || process.env.VITE_TMDB_API_KEY;

  if (!token) {
    return {
      status: 503,
      data: { status_message: "TMDB API token is not configured on the server." },
    };
  }

  const url = new URL(`${TMDB_API_BASE}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(revalidate === null ? { cache: "no-store" } : { next: { revalidate } }),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

export async function getTmdb(path, searchParams, revalidate = 900) {
  const result = await requestTmdb(path, searchParams, revalidate);
  if (result.status < 200 || result.status >= 300) {
    const error = new Error(result.data.status_message || "TMDB request failed.");
    error.status = result.status;
    throw error;
  }
  return result.data;
}

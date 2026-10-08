export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin === requestUrl.origin) return true;
  return request.headers.get("sec-fetch-site") === "same-origin";
}

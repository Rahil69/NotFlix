const KNOWN_ADULT_ANIME_IDS = new Set([
  70998, 207840, 204269, 95897, 78501, 241002, 233643, 100937, 113360,
]);
const ADULT_ANIME_TEXT = /\b(?:hentai|porn(?:ographic|ography)?|erotic|sexually explicit|sexual content|uncensored|18\+)\b/i;

export function isAdultTitle(title) {
  if (!title || typeof title !== "object") return false;

  const names = [title.title, title.original_title, title.name, title.original_name];
  const genres = title.genre_ids || title.genres?.map((genre) => genre.id);
  const isJapaneseAnimation = (title.original_language === "ja" || title.origin_country?.includes("JP"))
    && genres?.includes(16);
  const text = [...names, title.overview].filter((value) => typeof value === "string").join(" ");

  return title.adult === true
    || names.some((name) => typeof name === "string" && /\bhentai\b/i.test(name))
    || (isJapaneseAnimation && (KNOWN_ADULT_ANIME_IDS.has(Number(title.id)) || ADULT_ANIME_TEXT.test(text)));
}

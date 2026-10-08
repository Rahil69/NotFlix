import { notFound } from "next/navigation";
import WatchExperience from "./watch-experience";

function positiveNumber(value, fallback = 1) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 1000 ? number : fallback;
}

export default async function WatchPage({ params, searchParams }) {
  const { type, id } = await params;
  const query = await searchParams;
  if (!["movie", "tv"].includes(type) || !/^\d+$/.test(id)) notFound();

  return (
    <WatchExperience
      key={`${type}-${id}-${query?.season || 1}-${query?.episode || 1}`}
      id={Number(id)}
      mediaType={type}
      initialSeason={positiveNumber(query?.season)}
      initialEpisode={positiveNumber(query?.episode)}
    />
  );
}

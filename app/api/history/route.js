import { NextResponse } from "next/server";
import { isSameOrigin } from "../../../lib/request-security";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function privateJson(body, options = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { "Cache-Control": "private, no-store", ...options.headers },
  });
}

function parsePositiveInteger(value) {
  if (!/^\d+$/.test(String(value ?? ""))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function serializeProgress(row) {
  if (!row) return null;
  const durationSeconds = Number(row.duration_seconds) || 0;
  const positionSeconds = Number(row.position_seconds) || 0;
  const completed = Boolean(row.is_completed);
  return {
    id: row.id,
    mediaType: row.media_type,
    tmdbId: Number(row.tmdb_id),
    title: row.title,
    posterPath: row.poster_path,
    seasonNumber: Number(row.season_number) || null,
    episodeNumber: Number(row.episode_number) || null,
    positionSeconds,
    durationSeconds,
    resumeSeconds: completed ? 0 : positionSeconds,
    progressPercent: completed ? 100 : durationSeconds > 0 ? Math.min(100, Math.round(positionSeconds / durationSeconds * 100)) : 0,
    completed,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

async function getUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

export async function GET(request) {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getUser(supabase);
    if (!user) return privateJson({ error: "Sign in to view your watch history." }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const tmdbIdValue = params.get("tmdbId");
    if (tmdbIdValue === null) {
      const { data, error } = await supabase.from("watch_history")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return privateJson({ items: data.map(serializeProgress) });
    }

    const tmdbId = parsePositiveInteger(tmdbIdValue);
    const mediaType = params.get("mediaType");
    if (!tmdbId || !["movie", "tv"].includes(mediaType)) {
      return privateJson({ error: "Invalid title identifier." }, { status: 400 });
    }
    const seasonNumber = mediaType === "tv" ? parsePositiveInteger(params.get("seasonNumber")) : null;
    const episodeNumber = mediaType === "tv" ? parsePositiveInteger(params.get("episodeNumber")) : null;
    if (mediaType === "tv" && (!seasonNumber || !episodeNumber)) {
      return privateJson({ error: "A season and episode are required for TV progress." }, { status: 400 });
    }

    const { data, error } = await supabase.from("watch_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("media_type", mediaType)
      .eq("tmdb_id", tmdbId)
      .eq("season_number", seasonNumber || 0)
      .eq("episode_number", episodeNumber || 0)
      .maybeSingle();
    if (error) throw error;
    return privateJson({ item: serializeProgress(data) });
  } catch (error) {
    console.error("Could not load watch history:", error);
    return privateJson({ error: "Watch history is temporarily unavailable." }, { status: 503 });
  }
}

export async function PUT(request) {
  if (!isSameOrigin(request)) return privateJson({ error: "Request origin could not be verified." }, { status: 403 });

  try {
    const supabase = await createSupabaseServerClient();
    const user = await getUser(supabase);
    if (!user) return privateJson({ error: "Sign in to save watch progress." }, { status: 401 });

    let body;
    try {
      body = await request.json();
    } catch {
      return privateJson({ error: "Invalid watch progress." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return privateJson({ error: "Invalid watch progress." }, { status: 400 });
    }

    const tmdbId = parsePositiveInteger(body.tmdbId);
    const mediaType = body.mediaType;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const posterPath = typeof body.posterPath === "string" && /^\/[A-Za-z0-9/_-]{1,180}(?:\.[A-Za-z0-9]{1,8})?$/.test(body.posterPath)
      ? body.posterPath
      : null;
    const seasonNumber = mediaType === "tv" ? parsePositiveInteger(body.seasonNumber) : null;
    const episodeNumber = mediaType === "tv" ? parsePositiveInteger(body.episodeNumber) : null;
    const position = Number(body.positionSeconds);
    const duration = Number(body.durationSeconds);
    const status = body.status;

    if (!tmdbId || !["movie", "tv"].includes(mediaType) || !title) {
      return privateJson({ error: "Invalid watch progress." }, { status: 400 });
    }
    if (mediaType === "tv" && (!seasonNumber || !episodeNumber)) {
      return privateJson({ error: "A season and episode are required for TV progress." }, { status: 400 });
    }
    if (!["playing", "paused", "seeked", "completed"].includes(status)
      || !Number.isFinite(position) || !Number.isFinite(duration)
      || position < 0 || duration < 0 || position > 7 * 24 * 60 * 60 || duration > 7 * 24 * 60 * 60) {
      return privateJson({ error: "Invalid playback position." }, { status: 400 });
    }

    const key = {
      user_id: user.id,
      media_type: mediaType,
      tmdb_id: tmdbId,
      season_number: seasonNumber || 0,
      episode_number: episodeNumber || 0,
    };
    const { data: previous, error: readError } = await supabase.from("watch_history")
      .select("duration_seconds")
      .match(key)
      .maybeSingle();
    if (readError) throw readError;

    const completed = status === "completed";
    const positionSeconds = completed && duration > 0 ? duration : Math.min(position, duration > 0 ? duration : position);
    const record = {
      ...key,
      title,
      poster_path: posterPath,
      position_seconds: positionSeconds,
      duration_seconds: Math.max(Number(previous?.duration_seconds) || 0, duration),
      is_completed: completed,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("watch_history")
      .upsert(record, { onConflict: "user_id,media_type,tmdb_id,season_number,episode_number" })
      .select("*")
      .single();
    if (error) throw error;
    return privateJson({ item: serializeProgress(data) });
  } catch (error) {
    console.error("Could not save watch progress:", error);
    return privateJson({ error: "Could not save watch progress." }, { status: 503 });
  }
}

export async function DELETE(request) {
  if (!isSameOrigin(request)) return privateJson({ error: "Request origin could not be verified." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const tmdbId = parsePositiveInteger(params.get("tmdbId"));
  const mediaType = params.get("mediaType");
  if (!tmdbId || !["movie", "tv"].includes(mediaType)) {
    return privateJson({ error: "Invalid title identifier." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const user = await getUser(supabase);
    if (!user) return privateJson({ error: "Sign in to remove saved progress." }, { status: 401 });

    const { error } = await supabase.from("watch_history")
      .delete()
      .eq("user_id", user.id)
      .eq("media_type", mediaType)
      .eq("tmdb_id", tmdbId);
    if (error) throw error;
    return privateJson({ deleted: true });
  } catch (error) {
    console.error("Could not delete watch history:", error);
    return privateJson({ error: "Could not remove saved progress." }, { status: 503 });
  }
}

import { supabase } from "@/integrations/supabase/client";

const NAME_KEY = "dunewalker_player_name";
const ID_KEY = "dunewalker_player_id";
const BEST_KEY = "dunewalker_best";
const SYNCED_BEST_KEY = "dunewalker_synced_best";

export const NAME_MIN = 3;
export const NAME_MAX = 12;

export interface LeaderboardEntry {
  player_id: string;
  name: string;
  best_score: number;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function getPlayerName(): string | null {
  try {
    const n = localStorage.getItem(NAME_KEY);
    return n && n.trim().length >= NAME_MIN ? n : null;
  } catch {
    return null;
  }
}

export function setPlayerName(name: string): string {
  const clean = name.trim().slice(0, NAME_MAX);
  try {
    localStorage.setItem(NAME_KEY, clean);
  } catch { /* ignore */ }
  return clean;
}

export function getLocalBest(): number {
  try {
    const v = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function setLocalBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch { /* ignore */ }
}

export async function fetchTop10(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("player_id, name, best_score")
    .gt("best_score", 0)
    .order("best_score", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(10);
  if (error) {
    console.warn("[leaderboard] top10", error);
    return [];
  }
  const rows = (data ?? []) as LeaderboardEntry[];
  console.debug("[leaderboard] top10 loaded:", rows.length, "entries");
  return rows;
}

export async function fetchPlayerEntry(): Promise<LeaderboardEntry | null> {
  const id = getPlayerId();
  const { data, error } = await supabase
    .from("leaderboard")
    .select("player_id, name, best_score")
    .eq("player_id", id)
    .maybeSingle();
  if (error) {
    console.warn("[leaderboard] player entry", error);
    return null;
  }
  return (data as LeaderboardEntry | null) ?? null;
}

export async function fetchRank(score: number): Promise<number | null> {
  if (score <= 0) return null;
  const { data, error } = await supabase.rpc("get_rank", { p_score: score });
  if (error) {
    console.warn("[leaderboard] get_rank", error);
    return null;
  }
  return typeof data === "number" ? data : null;
}

/**
 * Only submits to the server when the score beats the locally cached best.
 * Returns the authoritative best + world rank when a submission happens.
 */
export async function submitIfBest(
  score: number,
): Promise<{ best: number; rank: number | null; submitted: boolean }> {
  const localBest = getLocalBest();
  let syncedBest = 0;
  try { syncedBest = parseInt(localStorage.getItem(SYNCED_BEST_KEY) || "0", 10) || 0; } catch { /* ignore */ }
  const effectiveBest = Math.max(score, localBest);
  // Skip only when the server already knows a best >= what we'd send.
  if (effectiveBest <= 0 || effectiveBest <= syncedBest) {
    return { best: localBest, rank: null, submitted: false };
  }
  if (score > localBest) setLocalBest(score);
  const name = getPlayerName() ?? "Player";
  const id = getPlayerId();
  const { data, error } = await supabase.rpc("submit_score", {
    p_player_id: id,
    p_name: name,
    p_score: effectiveBest,
  });
  if (error) {
    console.warn("[leaderboard] submit_score", error);
    return { best: score, rank: null, submitted: true };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const best = (row?.best_score as number) ?? score;
  const rank = (row?.rank as number) ?? null;
  if (best > localBest) setLocalBest(best);
  try { localStorage.setItem(SYNCED_BEST_KEY, String(best)); } catch { /* ignore */ }
  console.debug("[leaderboard] submitted:", { best, rank });
  return { best, rank, submitted: true };
}
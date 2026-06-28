import { supabase } from "@/integrations/supabase/client";

const NAME_KEY = "btr_player_name";
const ID_KEY = "btr_player_id";
const BEST_KEY = "btr_best";

export const NAME_MIN = 3;
export const NAME_MAX = 12;

export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  best_score: number;
  level: number;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) { id = uuid(); localStorage.setItem(ID_KEY, id); }
    return id;
  } catch {
    return uuid();
  }
}

export function getPlayerName(): string | null {
  try {
    const n = localStorage.getItem(NAME_KEY);
    return n && n.trim().length >= NAME_MIN ? n : null;
  } catch { return null; }
}

export function setPlayerName(name: string): string {
  const clean = name.trim().slice(0, NAME_MAX);
  try { localStorage.setItem(NAME_KEY, clean); } catch { /* ignore */ }
  return clean;
}

export function getLocalBest(): number {
  try {
    const v = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
}

function setLocalBest(score: number) {
  try { localStorage.setItem(BEST_KEY, String(score)); } catch { /* ignore */ }
}

/**
 * Upserts the player's score. The server keeps only the highest value
 * (best_score = GREATEST(existing, incoming)) via the row-level update path.
 * To enforce that without a SECURITY DEFINER function, we first read the
 * existing row and skip the write when the new score isn't higher.
 */
export async function submitScore(score: number, level: number): Promise<void> {
  const player_id = getPlayerId();
  const player_name = (getPlayerName() ?? "Player").slice(0, 24);
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));

  // Track local best for instant HUD display.
  if (safeScore > getLocalBest()) setLocalBest(safeScore);

  const { data: existing } = await supabase
    .from("leaderboard")
    .select("best_score")
    .eq("player_id", player_id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("leaderboard").insert({
      player_id, player_name, best_score: safeScore, level: safeLevel,
    });
    return;
  }

  if (safeScore > existing.best_score) {
    await supabase
      .from("leaderboard")
      .update({ player_name, best_score: safeScore, level: safeLevel, updated_at: new Date().toISOString() })
      .eq("player_id", player_id);
  } else {
    // Keep display name fresh even when score isn't beaten.
    await supabase
      .from("leaderboard")
      .update({ player_name })
      .eq("player_id", player_id);
  }
}

export async function fetchTop10(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("player_id, player_name, best_score, level")
    .order("best_score", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(10);
  if (error) {
    console.warn("[leaderboard] fetchTop10", error);
    return [];
  }
  return (data ?? []) as LeaderboardEntry[];
}
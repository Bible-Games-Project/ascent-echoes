import { supabase } from "@/integrations/supabase/client";

const NAME_KEY = "dunewalker_player_name";
const ID_KEY = "dunewalker_player_id";
const BEST_KEY = "dunewalker_best";
const TOP_CACHE_KEY = "dunewalker_top10_cache";
const RANK_CACHE_KEY = "dunewalker_rank_cache";
const PENDING_KEY = "dunewalker_pending_submits";

export const NAME_MIN = 3;
export const NAME_MAX = 12;

export interface LeaderboardEntry {
  player_id: string;
  name: string;
  best_score: number;
}

interface PendingSubmit {
  player_id: string;
  name: string;
  score: number;
  ts: number;
}

function isOnline(): boolean {
  try {
    return typeof navigator === "undefined" ? true : navigator.onLine !== false;
  } catch {
    return true;
  }
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function getPending(): PendingSubmit[] {
  return readJSON<PendingSubmit[]>(PENDING_KEY) ?? [];
}

function setPending(list: PendingSubmit[]) {
  writeJSON(PENDING_KEY, list);
}

function enqueuePending(entry: PendingSubmit) {
  const list = getPending();
  // Collapse: keep only highest score per player_id.
  const idx = list.findIndex((e) => e.player_id === entry.player_id);
  if (idx >= 0) {
    if (entry.score > list[idx].score) list[idx] = entry;
    else list[idx].name = entry.name; // keep latest name
  } else {
    list.push(entry);
  }
  setPending(list);
}

/**
 * Attempts to flush any queued offline submissions. Safe to call repeatedly;
 * does nothing if offline or queue empty. Returns true if all flushed.
 */
export async function flushPendingSubmits(): Promise<boolean> {
  if (!isOnline()) return false;
  const list = getPending();
  if (list.length === 0) return true;
  const remaining: PendingSubmit[] = [];
  for (const item of list) {
    console.log("[leaderboard] flushPendingSubmits calling submit_score", { player_id: item.player_id, score: item.score });
    const { data, error } = await supabase.rpc("submit_score", {
      p_player_id: item.player_id,
      p_name: item.name,
      p_score: item.score,
    });
    if (error) {
      console.log("[leaderboard] submit_score error (flush)", error);
      remaining.push(item);
    } else {
      console.log("[leaderboard] submit_score success (flush)", data);
    }
  }
  setPending(remaining);
  return remaining.length === 0;
}

// Auto-flush on connectivity restore.
if (typeof window !== "undefined") {
  try {
    window.addEventListener("online", () => { void flushPendingSubmits(); });
  } catch { /* ignore */ }
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

/**
 * Updates the display name on the existing leaderboard row for this device's
 * Player ID without changing its Best Score or rank. Safe to call even if the
 * player has no row yet — in that case we skip the network round-trip so we
 * don't create a phantom 0-score entry.
 */
export async function syncDisplayName(): Promise<boolean> {
  const name = getPlayerName();
  if (!name) return false;
  const id = getPlayerId();
  const best = getLocalBest();
  if (best <= 0) return false; // no existing leaderboard row yet
  if (!isOnline()) {
    enqueuePending({ player_id: id, name, score: best, ts: Date.now() });
    return false;
  }
  const { error } = await supabase.rpc("submit_score", {
    p_player_id: id,
    p_name: name,
    p_score: best, // GREATEST(existing, best) === existing, score preserved
  });
  if (error) {
    console.warn("[leaderboard] syncDisplayName", error);
    enqueuePending({ player_id: id, name, score: best, ts: Date.now() });
    return false;
  }
  return true;
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

export function getCachedTop10(): LeaderboardEntry[] {
  return readJSON<LeaderboardEntry[]>(TOP_CACHE_KEY) ?? [];
}

export function getCachedRank(): number | null {
  const v = readJSON<{ rank: number; best: number }>(RANK_CACHE_KEY);
  return v && typeof v.rank === "number" ? v.rank : null;
}

export async function fetchTop10(): Promise<LeaderboardEntry[]> {
  // Try flushing queued submits opportunistically so the fetched list
  // includes the player's latest score when connection is back.
  if (isOnline()) { void flushPendingSubmits(); }
  if (!isOnline()) return getCachedTop10();
  const { data, error } = await supabase
    .from("leaderboard")
    .select("player_id, name, best_score")
    .order("best_score", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(10);
  if (error) {
    console.warn("[leaderboard] top10", error);
    return getCachedTop10();
  }
  const raw = (data ?? []) as LeaderboardEntry[];
  console.debug("[leaderboard] raw supabase response", raw);
  // Defensive dedupe by player_id (server PK guarantees uniqueness, but we
  // collapse anyway so any future client-side merge can never produce dupes).
  const byId = new Map<string, LeaderboardEntry>();
  for (const row of raw) {
    const existing = byId.get(row.player_id);
    if (!existing || row.best_score > existing.best_score) byId.set(row.player_id, row);
  }
  const list = Array.from(byId.values())
    .sort((a, b) => b.best_score - a.best_score)
    .slice(0, 10);
  writeJSON(TOP_CACHE_KEY, list);
  return list;
}

export async function fetchRank(score: number): Promise<number | null> {
  if (score <= 0) return null;
  if (!isOnline()) {
    const cached = getCachedRank();
    return cached;
  }
  const { data, error } = await supabase.rpc("get_rank", { p_score: score });
  if (error) {
    console.warn("[leaderboard] get_rank", error);
    return getCachedRank();
  }
  const rank = typeof data === "number" ? data : null;
  if (rank != null) writeJSON(RANK_CACHE_KEY, { rank, best: score });
  return rank;
}

/**
 * Only submits to the server when the score beats the locally cached best.
 * Returns the authoritative best + world rank when a submission happens.
 * If offline, queues the submission to flush automatically on reconnect.
 */
export async function submitIfBest(
  score: number,
): Promise<{ best: number; rank: number | null; submitted: boolean }> {
  const localBest = getLocalBest();
  if (score <= localBest) {
    return { best: localBest, rank: null, submitted: false };
  }
  setLocalBest(score);
  const name = getPlayerName() ?? "Player";
  const id = getPlayerId();
  if (!isOnline()) {
    enqueuePending({ player_id: id, name, score, ts: Date.now() });
    return { best: score, rank: getCachedRank(), submitted: true };
  }
  const { data, error } = await supabase.rpc("submit_score", {
    p_player_id: id,
    p_name: name,
    p_score: score,
  });
  if (error) {
    console.warn("[leaderboard] submit_score", error);
    enqueuePending({ player_id: id, name, score, ts: Date.now() });
    return { best: score, rank: null, submitted: true };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const best = (row?.best_score as number) ?? score;
  const rank = (row?.rank as number) ?? null;
  if (best > localBest) setLocalBest(best);
  if (rank != null) writeJSON(RANK_CACHE_KEY, { rank, best });
  return { best, rank, submitted: true };
}
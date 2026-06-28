import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { getPlayerId, type LeaderboardEntry } from "./leaderboard";

export interface LeaderboardDoc {
  id: string;
  name: string;
  score: number;
  level: number;
  timestamp: Timestamp | null;
}

const COLLECTION = "leaderboard";

/**
 * Upsert this player's leaderboard entry. Identified by the stable
 * playerId (document id). Only writes when the new score beats the
 * stored personal best — otherwise the call is a no-op.
 *
 * Returns true when the document was created or updated.
 */
export async function submitLeaderboardEntry(input: {
  name: string;
  score: number;
  level: number;
  playerId?: string;
}): Promise<boolean> {
  const playerId = input.playerId ?? getPlayerId();
  const name = String(input.name ?? "").slice(0, 24);
  const score = Math.max(0, Math.floor(Number(input.score) || 0));
  const level = Math.max(1, Math.floor(Number(input.level) || 1));

  const ref = doc(db, COLLECTION, playerId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const prev = snap.data() as { score?: number };
    if (typeof prev.score === "number" && score <= prev.score) {
      console.log("[leaderboard] submit no-op (not higher)", { playerId, score, prev: prev.score });
      return false; // existing personal best is higher or equal — no-op
    }
    await setDoc(
      ref,
      { name, score, level, timestamp: serverTimestamp() },
      { merge: true },
    );
    console.log("[leaderboard] submit updated", { playerId, score, level });
    return true;
  }

  await setDoc(ref, {
    playerId,
    name,
    score,
    level,
    timestamp: serverTimestamp(),
  });
  console.log("[leaderboard] submit created", { playerId, score, level });
  return true;
}

/**
 * Read the top N entries globally, ordered by score (desc).
 * Uses Firestore's indexed orderBy + limit for an efficient query.
 */
export async function fetchTopLeaderboard(n = 10): Promise<LeaderboardDoc[]> {
  const q = query(
    collection(db, COLLECTION),
    orderBy("score", "desc"),
    limit(n),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<LeaderboardDoc, "id">;
    return { id: d.id, ...data };
  });
}

export async function fetchTopLeaderboardEntries(n = 10): Promise<LeaderboardEntry[]> {
  const docs = await fetchTopLeaderboard(n);
  return docs.map((d) => ({
    player_id: d.id,
    name: d.name ?? "Player",
    best_score: Number(d.score ?? 0),
  }));
}

export function subscribeTopLeaderboardEntries(
  n: number,
  cb: (entries: LeaderboardEntry[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    orderBy("score", "desc"),
    limit(n),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: LeaderboardEntry[] = snap.docs.map((d) => {
        const data = d.data() as { name?: string; score?: number };
        return {
          player_id: d.id,
          name: data.name ?? "Player",
          best_score: Number(data.score ?? 0),
        };
      });
      cb(list);
    },
    (err) => console.warn("[leaderboard] subscribe error", err),
  );
}
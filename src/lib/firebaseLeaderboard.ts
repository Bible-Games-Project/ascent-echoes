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
import { db } from "./firebase";
import { getPlayerId } from "./leaderboard";

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
      return false; // existing personal best is higher or equal — no-op
    }
    await setDoc(
      ref,
      { name, score, level, timestamp: serverTimestamp() },
      { merge: true },
    );
    return true;
  }

  await setDoc(ref, {
    playerId,
    name,
    score,
    level,
    timestamp: serverTimestamp(),
  });
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
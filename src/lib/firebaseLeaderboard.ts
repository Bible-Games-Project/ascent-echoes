import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface LeaderboardDoc {
  id: string;
  name: string;
  score: number;
  level: number;
  timestamp: Timestamp | null;
}

const COLLECTION = "leaderboard";

/**
 * Append a new score entry to the global leaderboard.
 * Entries are never overwritten — each run creates its own document.
 */
export async function submitLeaderboardEntry(input: {
  name: string;
  score: number;
  level: number;
}): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: String(input.name ?? "").slice(0, 24),
    score: Math.max(0, Math.floor(Number(input.score) || 0)),
    level: Math.max(1, Math.floor(Number(input.level) || 1)),
    timestamp: serverTimestamp(),
  });
  return ref.id;
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
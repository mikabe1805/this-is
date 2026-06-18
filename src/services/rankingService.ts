import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Pairwise place ranking — the "Beli loop". After a user saves a place they've
 * experienced, we ask 1–N "which did you prefer?" comparisons and binary-insert
 * it into their personal ranked list for that *sentiment bucket*, then derive a
 * 0–10 score from its position. Pure Firestore on `userRankings/{uid}` — zero
 * Google Places cost. Skippable, so it never blocks the save.
 */

export type Bucket = 'liked' | 'fine' | 'disliked'

export interface RankedItem {
  id: string
  name: string
}

export interface RankingDoc {
  liked: RankedItem[]
  fine: RankedItem[]
  disliked: RankedItem[]
  /** Denormalized 0–10 score per placeId, recomputed on every insert. */
  scores: Record<string, number>
}

// Beli-style score bands per bucket: a "liked" place can never score below a
// "fine" one. Within a band, position interpolates from high (best) to low.
const BANDS: Record<Bucket, [number, number]> = {
  liked: [6.8, 10],
  fine: [3.4, 6.7],
  disliked: [1.0, 3.3],
}

const BUCKETS: Bucket[] = ['liked', 'fine', 'disliked']

export const BUCKET_LABEL: Record<Bucket, string> = {
  liked: 'liked',
  fine: 'fine',
  disliked: 'disliked',
}

/**
 * Map a save's status (+ tried rating) to a sentiment bucket. `want` is a
 * wishlist intent (not experienced) → no ranking.
 */
export function sentimentBucket(status?: string | null, triedRating?: string | null): Bucket | null {
  if (status === 'loved') return 'liked'
  if (status === 'tried') {
    if (triedRating === 'disliked') return 'disliked'
    if (triedRating === 'neutral') return 'fine'
    return 'liked' // 'liked' or unspecified tried → liked
  }
  return null
}

function scoreFor(bucket: Bucket, pos: number, total: number): number {
  const [low, high] = BANDS[bucket]
  if (total <= 1) return high
  const frac = pos / (total - 1) // 0 = best → 1 = worst
  return Math.round((high - frac * (high - low)) * 10) / 10
}

class RankingService {
  private cache = new Map<string, { t: number; v: RankingDoc }>()

  private empty(): RankingDoc {
    return { liked: [], fine: [], disliked: [], scores: {} }
  }

  /** Read the user's ranking doc (60s cache). */
  async getRanking(userId: string): Promise<RankingDoc> {
    if (!userId) return this.empty()
    const c = this.cache.get(userId)
    if (c && Date.now() - c.t < 60_000) return c.v
    try {
      const snap = await getDoc(doc(db, 'userRankings', userId))
      const data = (snap.exists() ? snap.data() : {}) as Partial<RankingDoc>
      const v: RankingDoc = {
        liked: Array.isArray(data.liked) ? data.liked : [],
        fine: Array.isArray(data.fine) ? data.fine : [],
        disliked: Array.isArray(data.disliked) ? data.disliked : [],
        scores: data.scores || {},
      }
      this.cache.set(userId, { t: Date.now(), v })
      return v
    } catch (e) {
      console.warn('[ranking] getRanking failed', e)
      return this.empty()
    }
  }

  /** The user's score map (for displaying badges). 60s cache via getRanking. */
  async getScores(userId: string): Promise<Record<string, number>> {
    return (await this.getRanking(userId)).scores
  }

  /**
   * Insert `item` into `bucket` at `position` (best=0). A place can only live in
   * one bucket, so it's removed from all buckets first (re-rating moves it).
   * All scores are then recomputed and the doc is rewritten. Returns the placed
   * item's new score + rank.
   */
  async commitRanking(
    userId: string,
    bucket: Bucket,
    item: RankedItem,
    position: number,
  ): Promise<{ score: number; rank: number; total: number }> {
    const r = await this.getRanking(userId)
    // Remove any prior placement (could be a different bucket on a re-rate).
    for (const b of BUCKETS) r[b] = r[b].filter(x => x.id !== item.id)
    const arr = r[bucket]
    const pos = Math.max(0, Math.min(position, arr.length))
    arr.splice(pos, 0, { id: item.id, name: item.name })

    const scores: Record<string, number> = {}
    for (const b of BUCKETS) {
      r[b].forEach((it, i) => { scores[it.id] = scoreFor(b, i, r[b].length) })
    }
    r.scores = scores
    this.cache.set(userId, { t: Date.now(), v: r })

    try {
      await setDoc(doc(db, 'userRankings', userId), {
        liked: r.liked,
        fine: r.fine,
        disliked: r.disliked,
        scores,
        updatedAt: Timestamp.now(),
      })
    } catch (e) {
      console.warn('[ranking] commitRanking failed', e)
    }
    return { score: scores[item.id], rank: pos + 1, total: arr.length }
  }

  /** Bust the cache (e.g. after an external write). */
  invalidate(userId: string): void {
    this.cache.delete(userId)
  }
}

export const rankingService = new RankingService()

import { randomInt } from 'crypto';
import { query } from '../db/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WinnerRecord {
  subscriberId: string;
  matchTier: 3 | 4 | 5;
  matchedNumbers: number[];
}

export interface PlanBreakdown {
  pricePence: number;
  prizePoolContributionPct: number;
  subscriberCount: number;
}

export interface PrizePool {
  totalPool: number;
  tier5: number;
  tier4: number;
  tier3: number;
}

export interface TierAmounts {
  5: number;
  4: number;
  3: number;
}

export interface DistributedWinner extends WinnerRecord {
  prizeAmount: number;
}

export interface DistributionResult {
  winners: DistributedWinner[];
  nextJackpotCarryforward: number;
}

export interface DrawRecord {
  id: string;
  draw_month: string;
  draw_mode: string;
  draw_numbers: number[];
  prize_pool_total: string;
  jackpot_carryforward: string;
  tier_5_amount: string;
  tier_4_amount: string;
  tier_3_amount: string;
  active_subscriber_count: number;
  status: string;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
}

export interface DrawWinnerRow {
  id: string;
  draw_id: string;
  subscriber_id: string;
  match_tier: number;
  matched_numbers: number[];
  prize_amount: string;
  payment_state: string;
  verification_screenshot_url: string | null;
  verification_submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  payment_proof_url: string | null;
  created_at: string;
}

// ─── Task 9.1 — Random draw number generation ─────────────────────────────────

/**
 * Generates `count` distinct random integers in [min, max] using Fisher-Yates
 * shuffle with crypto.randomInt for cryptographic quality randomness.
 */
export function generateRandomNumbers(count = 5, min = 1, max = 45): number[] {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) pool.push(i);

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

// ─── Task 9.2 — Algorithmic (weighted) draw number generation ─────────────────

/**
 * Builds a frequency map from all active subscribers' score histories, then
 * performs weighted sampling without replacement using crypto.randomInt.
 */
export async function generateWeightedNumbers(count = 5): Promise<number[]> {
  // Fetch all score entries for active subscribers
  const rows = await query<{ stableford_score: number }>(
    `SELECT se.stableford_score
     FROM score_entries se
     JOIN subscribers s ON s.id = se.subscriber_id
     WHERE s.subscription_state = 'active'`
  );

  // Build frequency map
  const freq: Record<number, number> = {};
  for (const row of rows) {
    const n = row.stableford_score;
    freq[n] = (freq[n] ?? 0) + 1;
  }

  // Build weight array for [1..45]; floor weight = 1 so every number is selectable
  const weights: number[] = new Array(46).fill(0); // index 0 unused
  for (let n = 1; n <= 45; n++) {
    weights[n] = Math.max(freq[n] ?? 0, 1);
  }

  // Weighted sampling without replacement
  const selected: number[] = [];
  const remaining = [...weights]; // copy

  for (let draw = 0; draw < count; draw++) {
    const total = remaining.reduce((sum, w) => sum + w, 0);
    let r = randomInt(0, total);
    for (let n = 1; n <= 45; n++) {
      r -= remaining[n];
      if (r < 0) {
        selected.push(n);
        remaining[n] = 0; // remove from pool
        break;
      }
    }
  }

  return selected;
}

// ─── Task 9.4 — Match evaluation ──────────────────────────────────────────────

/**
 * For each subscriber, computes the intersection of their scores and the draw
 * numbers. Returns winner records for intersections of size >= 3.
 */
export function evaluateMatches(
  drawNumbers: number[],
  subscribers: Array<{ id: string; scores: number[] }>
): WinnerRecord[] {
  const drawSet = new Set(drawNumbers);
  const winners: WinnerRecord[] = [];

  for (const subscriber of subscribers) {
    const matched = subscriber.scores.filter((s) => drawSet.has(s));
    // Deduplicate matched numbers (scores could theoretically repeat)
    const uniqueMatched = [...new Set(matched)];
    if (uniqueMatched.length >= 3) {
      winners.push({
        subscriberId: subscriber.id,
        matchTier: Math.min(uniqueMatched.length, 5) as 3 | 4 | 5,
        matchedNumbers: uniqueMatched,
      });
    }
  }

  return winners;
}

// ─── Task 9.7 — Prize pool calculation and distribution ───────────────────────

/**
 * Calculates the prize pool from active subscribers' plan contributions plus
 * any jackpot carry-forward, then allocates across tiers.
 */
export function calculatePrizePool(
  _activeSubscriberCount: number,
  planBreakdown: PlanBreakdown[],
  jackpotCarryforward: number
): PrizePool {
  let basePool = 0;
  for (const plan of planBreakdown) {
    basePool += (plan.pricePence / 100) * (plan.prizePoolContributionPct / 100) * plan.subscriberCount;
  }

  const totalPool = basePool + jackpotCarryforward;

  return {
    totalPool,
    tier5: totalPool * 0.4,
    tier4: totalPool * 0.35,
    tier3: totalPool * 0.25,
  };
}

/**
 * Divides each tier's amount equally among winners in that tier.
 * If no tier-5 winner, the tier-5 amount becomes the next jackpot carry-forward.
 */
export function distributeWinnings(
  winners: WinnerRecord[],
  tierAmounts: TierAmounts
): DistributionResult {
  const distributed: DistributedWinner[] = winners.map((w) => ({ ...w, prizeAmount: 0 }));

  for (const tier of [5, 4, 3] as const) {
    const tierWinners = distributed.filter((w) => w.matchTier === tier);
    if (tierWinners.length > 0) {
      const share = tierAmounts[tier] / tierWinners.length;
      for (const w of tierWinners) {
        w.prizeAmount = share;
      }
    }
  }

  const hasTier5Winner = distributed.some((w) => w.matchTier === 5);
  const nextJackpotCarryforward = hasTier5Winner ? 0 : tierAmounts[5];

  return { winners: distributed, nextJackpotCarryforward };
}

// ─── DB helpers used by routes ────────────────────────────────────────────────

/** Fetch all active subscribers with their score entries for draw evaluation. */
export async function getActiveSubscribersWithScores(): Promise<
  Array<{ id: string; scores: number[] }>
> {
  const rows = await query<{ subscriber_id: string; stableford_score: number | null }>(
    `SELECT s.id AS subscriber_id, se.stableford_score
     FROM subscribers s
     LEFT JOIN score_entries se ON se.subscriber_id = s.id
     WHERE s.subscription_state = 'active'
     ORDER BY s.id, se.played_on DESC`
  );

  const map = new Map<string, number[]>();
  for (const row of rows) {
    if (!map.has(row.subscriber_id)) map.set(row.subscriber_id, []);
    if (row.stableford_score !== null) map.get(row.subscriber_id)!.push(row.stableford_score);
  }

  return Array.from(map.entries()).map(([id, scores]) => ({ id, scores }));
}

/** Fetch plan breakdown for active subscribers. */
export async function getActivePlanBreakdown(): Promise<PlanBreakdown[]> {
  const rows = await query<{
    price_pence: number;
    prize_pool_contribution_pct: string;
    subscriber_count: string;
  }>(
    `SELECT sp.price_pence, sp.prize_pool_contribution_pct, COUNT(s.id) AS subscriber_count
     FROM subscribers s
     JOIN subscription_plans sp ON sp.stripe_price_id = s.stripe_subscription_id
     WHERE s.subscription_state = 'active'
     GROUP BY sp.price_pence, sp.prize_pool_contribution_pct`
  );

  // Fallback: if no plan join data, count active subscribers with a flat estimate
  if (rows.length === 0) {
    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM subscribers WHERE subscription_state = 'active'`
    );
    const count = parseInt(countRows[0]?.count ?? '0', 10);
    if (count === 0) return [];
    // Use default plan values from seed data (monthly: 999 pence, 20% prize pool)
    return [{ pricePence: 999, prizePoolContributionPct: 20, subscriberCount: count }];
  }

  return rows.map((r) => ({
    pricePence: r.price_pence,
    prizePoolContributionPct: parseFloat(r.prize_pool_contribution_pct),
    subscriberCount: parseInt(r.subscriber_count, 10),
  }));
}

/** Get the most recent jackpot carry-forward from the last published draw. */
export async function getLastJackpotCarryforward(): Promise<number> {
  const rows = await query<{ jackpot_carryforward: string }>(
    `SELECT jackpot_carryforward FROM draws WHERE status = 'published' ORDER BY draw_month DESC LIMIT 1`
  );
  if (rows.length === 0) return 0;
  return parseFloat(rows[0].jackpot_carryforward);
}

/** List all published draws ordered by draw_month DESC. */
export async function listPublishedDraws(): Promise<DrawRecord[]> {
  return query<DrawRecord>(
    `SELECT id, draw_month, draw_mode, draw_numbers, prize_pool_total,
            jackpot_carryforward, tier_5_amount, tier_4_amount, tier_3_amount,
            active_subscriber_count, status, published_at, published_by, created_at
     FROM draws
     WHERE status = 'published'
     ORDER BY draw_month DESC`
  );
}

/** Get a single draw by ID. */
export async function getDrawById(id: string): Promise<DrawRecord | null> {
  const rows = await query<DrawRecord>(
    `SELECT id, draw_month, draw_mode, draw_numbers, prize_pool_total,
            jackpot_carryforward, tier_5_amount, tier_4_amount, tier_3_amount,
            active_subscriber_count, status, published_at, published_by, created_at
     FROM draws WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/** Get winners for a draw with subscriber info. */
export async function getDrawWinners(drawId: string): Promise<DrawWinnerRow[]> {
  return query<DrawWinnerRow>(
    `SELECT dw.id, dw.draw_id, dw.subscriber_id, dw.match_tier, dw.matched_numbers,
            dw.prize_amount, dw.payment_state, dw.verification_screenshot_url,
            dw.verification_submitted_at, dw.reviewed_by, dw.reviewed_at,
            dw.rejection_reason, dw.payment_proof_url, dw.created_at,
            s.email, s.first_name, s.last_name
     FROM draw_winners dw
     JOIN subscribers s ON s.id = dw.subscriber_id
     WHERE dw.draw_id = $1
     ORDER BY dw.match_tier DESC, dw.prize_amount DESC`,
    [drawId]
  );
}

/** Persist a published draw and its winners in a transaction. */
export async function persistDraw(
  drawMonth: string,
  drawMode: 'random' | 'algorithmic',
  drawNumbers: number[],
  lastJackpotCarryforward: number,
  prizePool: PrizePool,
  activeSubscriberCount: number,
  publishedBy: string,
  winners: DistributedWinner[]
): Promise<DrawRecord> {
  const { pool } = await import('../db/client');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const drawRows = await client.query(
      `INSERT INTO draws (
         draw_month, draw_mode, draw_numbers, prize_pool_total,
         jackpot_carryforward, tier_5_amount, tier_4_amount, tier_3_amount,
         active_subscriber_count, status, published_at, published_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', NOW(), $9)
       RETURNING *`,
      [
        drawMonth,
        drawMode,
        drawNumbers,
        lastJackpotCarryforward,
        prizePool.tier5,
        prizePool.tier4,
        prizePool.tier3,
        activeSubscriberCount,
        publishedBy,
      ]
    ) as any;

    const draw = drawRows.rows[0];

    for (const winner of winners) {
      await client.query(
        `INSERT INTO draw_winners (draw_id, subscriber_id, match_tier, matched_numbers, prize_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [draw.id, winner.subscriberId, winner.matchTier, winner.matchedNumbers, winner.prizeAmount]
      );
    }

    await client.query('COMMIT');
    return draw;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

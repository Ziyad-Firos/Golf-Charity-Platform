import { query } from '../db/client';

export interface ScoreEntry {
  id: string;
  subscriber_id: string;
  stableford_score: number;
  played_on: string;
  created_at: string;
  updated_at: string;
}

const MAX_SCORES = 5;

export function validateStablefordScore(score: unknown): string | null {
  if (typeof score !== 'number' || !Number.isInteger(score)) {
    return 'stablefordScore must be an integer';
  }
  if (score < 1 || score > 45) {
    return 'stablefordScore must be between 1 and 45';
  }
  return null;
}

export function validatePlayedOn(playedOn: unknown): string | null {
  if (typeof playedOn !== 'string' || !playedOn.trim()) {
    return 'playedOn is required';
  }
  const d = new Date(playedOn);
  if (isNaN(d.getTime())) {
    return 'playedOn must be a valid date string';
  }
  return null;
}

export async function getScoresBySubscriber(subscriberId: string): Promise<ScoreEntry[]> {
  return query<ScoreEntry>(
    `SELECT id, subscriber_id, stableford_score, played_on, created_at, updated_at
     FROM score_entries
     WHERE subscriber_id = $1
     ORDER BY played_on DESC`,
    [subscriberId]
  );
}

export async function addScore(
  subscriberId: string,
  stablefordScore: number,
  playedOn: string
): Promise<ScoreEntry> {
  const countRows = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM score_entries WHERE subscriber_id = $1',
    [subscriberId]
  );
  const count = parseInt(countRows[0].count, 10);

  if (count >= MAX_SCORES) {
    await query(
      `DELETE FROM score_entries
       WHERE id = (
         SELECT id FROM score_entries
         WHERE subscriber_id = $1
         ORDER BY played_on ASC
         LIMIT 1
       )`,
      [subscriberId]
    );
  }

  const rows = await query<ScoreEntry>(
    `INSERT INTO score_entries (subscriber_id, stableford_score, played_on)
     VALUES ($1, $2, $3)
     RETURNING id, subscriber_id, stableford_score, played_on, created_at, updated_at`,
    [subscriberId, stablefordScore, playedOn]
  );
  return rows[0];
}

export async function getScoreByIdAndSubscriber(
  id: string,
  subscriberId: string
): Promise<ScoreEntry | null> {
  const rows = await query<ScoreEntry>(
    `SELECT id, subscriber_id, stableford_score, played_on, created_at, updated_at
     FROM score_entries
     WHERE id = $1 AND subscriber_id = $2`,
    [id, subscriberId]
  );
  return rows[0] ?? null;
}

export async function updateScore(
  id: string,
  subscriberId: string,
  stablefordScore: number,
  playedOn: string
): Promise<ScoreEntry | null> {
  const rows = await query<ScoreEntry>(
    `UPDATE score_entries
     SET stableford_score = $1, played_on = $2, updated_at = NOW()
     WHERE id = $3 AND subscriber_id = $4
     RETURNING id, subscriber_id, stableford_score, played_on, created_at, updated_at`,
    [stablefordScore, playedOn, id, subscriberId]
  );
  return rows[0] ?? null;
}

export async function deleteScore(id: string, subscriberId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM score_entries WHERE id = $1 AND subscriber_id = $2 RETURNING id`,
    [id, subscriberId]
  );
  return rows.length > 0;
}

export async function getScoreById(id: string): Promise<ScoreEntry | null> {
  const rows = await query<ScoreEntry>(
    `SELECT id, subscriber_id, stableford_score, played_on, created_at, updated_at
     FROM score_entries WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function adminUpdateScore(
  id: string,
  stablefordScore: number,
  playedOn: string
): Promise<ScoreEntry | null> {
  const rows = await query<ScoreEntry>(
    `UPDATE score_entries
     SET stableford_score = $1, played_on = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, subscriber_id, stableford_score, played_on, created_at, updated_at`,
    [stablefordScore, playedOn, id]
  );
  return rows[0] ?? null;
}

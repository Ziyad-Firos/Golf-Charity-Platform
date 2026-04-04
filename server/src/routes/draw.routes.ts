import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import {
  generateRandomNumbers,
  generateWeightedNumbers,
  evaluateMatches,
  calculatePrizePool,
  distributeWinnings,
  getActiveSubscribersWithScores,
  getActivePlanBreakdown,
  getLastJackpotCarryforward,
  listPublishedDraws,
  getDrawById,
  getDrawWinners,
  persistDraw,
} from '../services/draw.service';

// ─── Public draw routes ───────────────────────────────────────────────────────

export const drawRouter = Router();

// GET /api/draws — list all published draws ordered by draw_month DESC
drawRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const draws = await listPublishedDraws();
    res.json({ draws });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// GET /api/draws/:id — draw detail with draw_numbers, prize amounts, status
drawRouter.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid draw ID')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg } });
      return;
    }

    try {
      const draw = await getDrawById(req.params.id);
      if (!draw) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Draw not found' } });
        return;
      }
      // Only expose published draws on the public endpoint
      if (draw.status !== 'published') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Draw not found' } });
        return;
      }
      res.json({ draw });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// ─── Admin draw routes ────────────────────────────────────────────────────────

export const adminDrawRouter = Router();

// POST /api/admin/draws/simulate — dry-run, no DB writes
adminDrawRouter.post(
  '/simulate',
  authenticateToken,
  requireAdmin,
  [body('drawMode').isIn(['random', 'algorithmic']).withMessage('drawMode must be "random" or "algorithmic"')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg } });
      return;
    }

    try {
      const { drawMode } = req.body as { drawMode: 'random' | 'algorithmic' };

      // Generate draw numbers
      const drawNumbers =
        drawMode === 'algorithmic'
          ? await generateWeightedNumbers()
          : generateRandomNumbers();

      // Fetch active subscribers with scores
      const subscribers = await getActiveSubscribersWithScores();
      const activeSubscriberCount = subscribers.length;

      // Evaluate matches
      const winnerRecords = evaluateMatches(drawNumbers, subscribers);

      // Calculate prize pool
      const planBreakdown = await getActivePlanBreakdown();
      const jackpotCarryforward = await getLastJackpotCarryforward();
      const prizePool = calculatePrizePool(activeSubscriberCount, planBreakdown, jackpotCarryforward);

      // Distribute winnings
      const { winners, nextJackpotCarryforward } = distributeWinnings(winnerRecords, {
        5: prizePool.tier5,
        4: prizePool.tier4,
        3: prizePool.tier3,
      });

      res.json({
        simulation: {
          drawMode,
          drawNumbers,
          activeSubscriberCount,
          prizePool,
          jackpotCarryforward,
          nextJackpotCarryforward,
          winners,
        },
      });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// POST /api/admin/draws/publish — persist draw, winners, prize amounts
adminDrawRouter.post(
  '/publish',
  authenticateToken,
  requireAdmin,
  [body('drawMode').isIn(['random', 'algorithmic']).withMessage('drawMode must be "random" or "algorithmic"')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg } });
      return;
    }

    try {
      const { drawMode } = req.body as { drawMode: 'random' | 'algorithmic' };

      // Enforce one draw per calendar month
      const now = new Date();
      const drawMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const { query } = await import('../db/client');
      const existing = await query<{ id: string }>(
        `SELECT id FROM draws WHERE draw_month = $1`,
        [drawMonth]
      );
      if (existing.length > 0) {
        res.status(409).json({
          error: { code: 'DRAW_ALREADY_PUBLISHED', message: 'A draw has already been published for this calendar month' },
        });
        return;
      }

      // Generate draw numbers
      const drawNumbers =
        drawMode === 'algorithmic'
          ? await generateWeightedNumbers()
          : generateRandomNumbers();

      // Fetch active subscribers with scores
      const subscribers = await getActiveSubscribersWithScores();
      const activeSubscriberCount = subscribers.length;

      // Evaluate matches
      const winnerRecords = evaluateMatches(drawNumbers, subscribers);

      // Calculate prize pool
      const planBreakdown = await getActivePlanBreakdown();
      const jackpotCarryforward = await getLastJackpotCarryforward();
      const prizePool = calculatePrizePool(activeSubscriberCount, planBreakdown, jackpotCarryforward);

      // Distribute winnings
      const { winners, nextJackpotCarryforward } = distributeWinnings(winnerRecords, {
        5: prizePool.tier5,
        4: prizePool.tier4,
        3: prizePool.tier3,
      });

      // Persist to DB
      const publishedBy = req.user!.id;
      const distributedWinners = winners;
      const lastJackpotCarryforward = jackpotCarryforward;
      const draw = await persistDraw(
        drawMonth,
        drawMode,
        drawNumbers,
        lastJackpotCarryforward,
        prizePool,
        activeSubscriberCount,
        publishedBy,
        distributedWinners
      );

      // Fire-and-forget draw results notification (non-blocking)
      import('../services/notification.service')
        .then(({ sendDrawResults }) => sendDrawResults(draw.id))
        .catch(() => { /* notification failure is non-fatal */ });

      res.status(201).json({ draw, winners });
    } catch (err: unknown) {
      // Postgres unique constraint violation on draw_month
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === '23505'
      ) {
        res.status(409).json({
          error: { code: 'DRAW_ALREADY_PUBLISHED', message: 'A draw has already been published for this calendar month' },
        });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// GET /api/admin/draws/:id/winners — winners with subscriber info and payment state
adminDrawRouter.get(
  '/:id/winners',
  authenticateToken,
  requireAdmin,
  [param('id').isUUID().withMessage('Invalid draw ID')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg } });
      return;
    }

    try {
      const draw = await getDrawById(req.params.id);
      if (!draw) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Draw not found' } });
        return;
      }

      const winners = await getDrawWinners(req.params.id);
      res.json({ winners });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

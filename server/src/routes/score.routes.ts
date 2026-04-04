import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin, requireActiveSubscription } from '../middleware/auth.middleware';
import {
  validateStablefordScore,
  validatePlayedOn,
  getScoresBySubscriber,
  addScore,
  getScoreByIdAndSubscriber,
  updateScore,
  deleteScore,
  getScoreById,
  adminUpdateScore,
} from '../services/score.service';

// ─── Subscriber score routes ──────────────────────────────────────────────────

export const scoreRouter = Router();

// POST /api/scores
scoreRouter.post(
  '/',
  authenticateToken,
  requireActiveSubscription,
  async (req: Request, res: Response): Promise<void> => {
    const { stablefordScore, playedOn } = req.body as { stablefordScore: unknown; playedOn: unknown };
    const fields: Record<string, string> = {};
    const scoreError = validateStablefordScore(stablefordScore);
    if (scoreError) fields['stablefordScore'] = scoreError;
    const dateError = validatePlayedOn(playedOn);
    if (dateError) fields['playedOn'] = dateError;

    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields } });
      return;
    }

    try {
      const entry = await addScore(req.user!.id, stablefordScore as number, playedOn as string);
      res.status(201).json({ score: entry });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// GET /api/scores
scoreRouter.get(
  '/',
  authenticateToken,
  requireActiveSubscription,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const scores = await getScoresBySubscriber(req.user!.id);
      res.json({ scores });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// PUT /api/scores/:id
scoreRouter.put(
  '/:id',
  authenticateToken,
  requireActiveSubscription,
  [param('id').isUUID().withMessage('Invalid score ID')],
  async (req: Request, res: Response): Promise<void> => {
    const paramErrors = validationResult(req);
    if (!paramErrors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: paramErrors.array()[0].msg } });
      return;
    }

    const { stablefordScore, playedOn } = req.body as { stablefordScore: unknown; playedOn: unknown };
    const fields: Record<string, string> = {};
    const scoreError = validateStablefordScore(stablefordScore);
    if (scoreError) fields['stablefordScore'] = scoreError;
    const dateError = validatePlayedOn(playedOn);
    if (dateError) fields['playedOn'] = dateError;

    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields } });
      return;
    }

    try {
      const existing = await getScoreByIdAndSubscriber(req.params.id, req.user!.id);
      if (!existing) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Score entry not found' } });
        return;
      }
      const updated = await updateScore(req.params.id, req.user!.id, stablefordScore as number, playedOn as string);
      res.json({ score: updated });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// DELETE /api/scores/:id
scoreRouter.delete(
  '/:id',
  authenticateToken,
  requireActiveSubscription,
  [param('id').isUUID().withMessage('Invalid score ID')],
  async (req: Request, res: Response): Promise<void> => {
    const paramErrors = validationResult(req);
    if (!paramErrors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: paramErrors.array()[0].msg } });
      return;
    }

    try {
      const deleted = await deleteScore(req.params.id, req.user!.id);
      if (!deleted) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Score entry not found' } });
        return;
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// ─── Admin score routes ───────────────────────────────────────────────────────

export const adminScoreRouter = Router();

// GET /api/admin/scores/:subscriberId
adminScoreRouter.get(
  '/:subscriberId',
  authenticateToken,
  requireAdmin,
  [param('subscriberId').isUUID().withMessage('Invalid subscriber ID')],
  async (req: Request, res: Response): Promise<void> => {
    const paramErrors = validationResult(req);
    if (!paramErrors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: paramErrors.array()[0].msg } });
      return;
    }
    try {
      const scores = await getScoresBySubscriber(req.params.subscriberId);
      res.json({ scores });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// PUT /api/admin/scores/:id
adminScoreRouter.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [param('id').isUUID().withMessage('Invalid score ID')],
  async (req: Request, res: Response): Promise<void> => {
    const paramErrors = validationResult(req);
    if (!paramErrors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: paramErrors.array()[0].msg } });
      return;
    }

    const { stablefordScore, playedOn } = req.body as { stablefordScore: unknown; playedOn: unknown };
    const fields: Record<string, string> = {};
    const scoreError = validateStablefordScore(stablefordScore);
    if (scoreError) fields['stablefordScore'] = scoreError;
    const dateError = validatePlayedOn(playedOn);
    if (dateError) fields['playedOn'] = dateError;

    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields } });
      return;
    }

    try {
      const existing = await getScoreById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Score entry not found' } });
        return;
      }
      const updated = await adminUpdateScore(req.params.id, stablefordScore as number, playedOn as string);
      res.json({ score: updated });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

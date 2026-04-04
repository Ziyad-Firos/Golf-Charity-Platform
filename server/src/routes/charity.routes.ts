import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin, requireActiveSubscription } from '../middleware/auth.middleware';
import {
  getActiveCharities,
  getFeaturedCharity,
  getCharityById,
  getSubscriberCharity,
  updateSubscriberCharity,
  updateContributionPercentage,
  createDonationPaymentIntent,
  createCharity,
  updateCharity,
  deleteCharity,
  featureCharity,
} from '../services/charity.service';

// ─── Public charity router ────────────────────────────────────────────────────

export const charityRouter = Router();

// GET /api/charities/featured  — must be before /:id to avoid route shadowing
charityRouter.get('/featured', async (req: Request, res: Response): Promise<void> => {
  try {
    const charity = await getFeaturedCharity();
    if (!charity) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No featured charity found' } });
      return;
    }
    res.json(charity);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// GET /api/charities
charityRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const filter = typeof req.query.filter === 'string' ? req.query.filter : undefined;
    const charities = await getActiveCharities(search, filter);
    res.json(charities);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// GET /api/charities/:id
charityRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const charity = await getCharityById(req.params.id);
    if (!charity) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Charity not found' } });
      return;
    }
    res.json(charity);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// POST /api/charities/:id/donate  (requires active subscription)
charityRouter.post(
  '/:id/donate',
  authenticateToken,
  requireActiveSubscription,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { amountPence } = req.body as { amountPence: unknown };

      if (typeof amountPence !== 'number' || !Number.isInteger(amountPence) || amountPence <= 0) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'amountPence must be a positive integer' },
        });
        return;
      }

      const result = await createDonationPaymentIntent(req.user!.id, req.params.id, amountPence);
      res.status(201).json(result);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'NOT_FOUND') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: e.message } });
        return;
      }
      if (e.code === 'VALIDATION_ERROR') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } });
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// ─── Subscriber charity router ────────────────────────────────────────────────

export const subscriberCharityRouter = Router();

subscriberCharityRouter.use(authenticateToken, requireActiveSubscription);

// GET /api/subscriber/charity
subscriberCharityRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const info = await getSubscriberCharity(req.user!.id);
    res.json(info);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// PUT /api/subscriber/charity
subscriberCharityRouter.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { charityId } = req.body as { charityId: unknown };

    if (typeof charityId !== 'string' || !charityId.trim()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'charityId is required' } });
      return;
    }

    await updateSubscriberCharity(req.user!.id, charityId);
    res.json({ message: 'Charity updated successfully' });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'NOT_FOUND') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: e.message } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// PUT /api/subscriber/charity/contribution
subscriberCharityRouter.put('/contribution', async (req: Request, res: Response): Promise<void> => {
  try {
    const { percentage } = req.body as { percentage: unknown };

    if (typeof percentage !== 'number') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'percentage must be a number' } });
      return;
    }

    await updateContributionPercentage(req.user!.id, percentage);
    res.json({ message: 'Contribution percentage updated successfully' });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'VALIDATION_ERROR') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// ─── Admin charity router ─────────────────────────────────────────────────────

export const adminCharityRouter = Router();

adminCharityRouter.use(authenticateToken, requireAdmin);

// POST /api/admin/charities
adminCharityRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, imageUrls, events } = req.body as {
      name: unknown;
      description?: unknown;
      imageUrls?: unknown;
      events?: unknown;
    };

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
      return;
    }

    const charity = await createCharity({
      name: name.trim(),
      description: typeof description === 'string' ? description : undefined,
      imageUrls: Array.isArray(imageUrls) ? (imageUrls as string[]) : undefined,
      events: Array.isArray(events)
        ? (events as Array<{ title: string; event_date: string; description?: string }>)
        : undefined,
    });

    res.status(201).json(charity);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// PUT /api/admin/charities/:id
adminCharityRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, imageUrls, isActive } = req.body as {
      name?: unknown;
      description?: unknown;
      imageUrls?: unknown;
      isActive?: unknown;
    };

    const charity = await updateCharity(req.params.id, {
      name: typeof name === 'string' ? name : undefined,
      description: typeof description === 'string' ? description : undefined,
      imageUrls: Array.isArray(imageUrls) ? (imageUrls as string[]) : undefined,
      isActive: typeof isActive === 'boolean' ? isActive : undefined,
    });

    if (!charity) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Charity not found' } });
      return;
    }

    res.json(charity);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// DELETE /api/admin/charities/:id
adminCharityRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await deleteCharity(req.params.id);

    if (result === null) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Charity not found' } });
      return;
    }

    res.status(204).send();
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; affectedCount?: number };
    if (e.code === 'CHARITY_HAS_SUBSCRIBERS') {
      res.status(409).json({
        error: {
          code: 'CHARITY_HAS_SUBSCRIBERS',
          message: e.message,
          affectedCount: e.affectedCount,
        },
      });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// PUT /api/admin/charities/:id/feature
adminCharityRouter.put('/:id/feature', async (req: Request, res: Response): Promise<void> => {
  try {
    const charity = await featureCharity(req.params.id);

    if (!charity) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Charity not found' } });
      return;
    }

    res.json(charity);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

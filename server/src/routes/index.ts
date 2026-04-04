import { Router } from 'express';
import authRoutes from './auth';
import charityRoutes from './charities';
import subscriptionRoutes from './subscriptions';
import scoreRoutes from './scores';
import drawRoutes from './draws';

const router = Router();

router.use('/auth', authRoutes);
router.use('/charities', charityRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/scores', scoreRoutes);
router.use('/draws', drawRoutes);

export default router;

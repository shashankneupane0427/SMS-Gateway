import express from 'express';
import { prisma } from './helpers.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const providers = await prisma.provider.findMany({ orderBy: { priority: 'asc' } });

  const result = [];
  for (const provider of providers) {
    const attempts = await prisma.attempt.count({
      where: { providerId: provider.id, createdAt: { gte: since } },
    });
    const successes = await prisma.attempt.count({
      where: { providerId: provider.id, createdAt: { gte: since }, success: true },
    });

    const successRate = attempts === 0 ? 100 : (successes / attempts) * 100;
    const balanceScore = Math.min(provider.balance / 1000, 1) * 100;
    const health = 0.7 * successRate + 0.3 * balanceScore;

    result.push({
      route: provider.name,
      balance: provider.balance,
      attempts,
      successRate: Math.round(successRate),
      health: Math.round(health),
    });
  }

  res.json(result);
});

export default router;

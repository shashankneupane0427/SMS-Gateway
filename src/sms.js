import express from 'express';
import { prisma, normalizeNumber, countParts, getBalance, sendWithProvider } from './helpers.js';

export const router = express.Router();

export async function sendMessage(message) {
  const providers = await prisma.provider.findMany({ orderBy: { priority: 'asc' } });

  for (const provider of providers) {
    if ((await getBalance(provider)) < message.parts) continue;

    const success = sendWithProvider(provider);
    await prisma.attempt.create({ data: { providerId: provider.id, success } });

    if (success) {
      await prisma.provider.update({
        where: { id: provider.id },
        data: { balance: { decrement: message.parts } },
      });
      await prisma.message.updateMany({
        where: { id: message.id, status: 'pending' },
        data: { status: 'sent', route: provider.name },
      });
      return;
    }
  }

  await prisma.$transaction(async (tx) => {
    const failed = await tx.message.updateMany({
      where: { id: message.id, status: 'pending' },
      data: { status: 'failed' },
    });
    if (failed.count === 1) {
      await tx.wallet.update({
        where: { userId: message.userId },
        data: { credits: { increment: message.parts } },
      });
    }
  });
}

router.post('/send', async (req, res) => {
  const { to, message } = req.body || {};
  if (!Array.isArray(to) || to.length === 0 || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: '"to" (list of numbers) and "message" (text) are required' });
  }

  const numbers = [];
  const invalid = [];
  for (const input of to) {
    const number = normalizeNumber(input);
    if (number) numbers.push(number);
    else invalid.push(input);
  }
  if (invalid.length > 0) {
    return res.status(400).json({ error: 'Invalid phone numbers', invalid });
  }

  const parts = countParts(message);
  const cost = parts * numbers.length;

  const created = await prisma.$transaction(async (tx) => {
    const paid = await tx.wallet.updateMany({
      where: { userId: req.userId, credits: { gte: cost } },
      data: { credits: { decrement: cost } },
    });
    if (paid.count === 0) return null;

    const list = [];
    for (const recipient of numbers) {
      list.push(await tx.message.create({
        data: { userId: req.userId, recipient, body: message, parts },
      }));
    }
    return list;
  });

  if (!created) {
    return res.status(402).json({ error: 'Not enough credits', required: cost });
  }

  for (const item of created) {
    await sendMessage(item);
  }

  const messages = await prisma.message.findMany({
    where: { id: { in: created.map((m) => m.id) } },
    orderBy: { id: 'asc' },
  });
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
  const refunded = messages.filter((m) => m.status === 'failed').length * parts;

  res.json({ parts, cost, refunded, balance: wallet.credits, messages });
});

router.get('/logs', async (req, res) => {
  const { status, date, number } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

  const where = { userId: req.userId };

  if (status) {
    if (!['pending', 'sent', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, sent or failed' });
    }
    where.status = status;
  }

  if (number) {
    const normalized = normalizeNumber(number);
    if (!normalized) return res.status(400).json({ error: 'Invalid number filter' });
    where.recipient = normalized;
  }

  if (date) {
    const start = new Date(date);
    if (isNaN(start)) return res.status(400).json({ error: 'date must look like 2026-10-27' });
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    where.createdAt = { gte: start, lt: end };
  }

  const total = await prisma.message.count({ where });
  const data = await prisma.message.findMany({
    where,
    orderBy: { id: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  res.json({ page, limit, total, data });
});

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './helpers.js';

export const router = express.Router();

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

export function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Missing or invalid token' });
  }
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || password.length < 6) {
    return res.status(400).json({ error: 'Email and a password of at least 6 characters are required' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      wallet: { create: { credits: 100 } },
    },
  });

  res.status(201).json({ token: makeToken(user.id), credits: 100 });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  res.json({ token: makeToken(user.id) });
});

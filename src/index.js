import 'dotenv/config';
import express from 'express';
import { prisma } from './helpers.js';
import { router as authRouter, auth } from './auth.js';
import { router as smsRouter, sendMessage } from './sms.js';
import routesRouter from './routes.js';

const app = express();
app.use(express.json());

app.use('/auth', authRouter);
app.use('/sms', auth, smsRouter);
app.use('/routes', routesRouter);

app.get('/wallet', auth, async (req, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
  res.json({ credits: wallet.credits });
});

async function finishPendingMessages() {
  const pending = await prisma.message.findMany({ where: { status: 'pending' } });
  for (const message of pending) {
    await sendMessage(message);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  finishPendingMessages().catch(console.error);
});

# Mini SMS Gateway

REST API that accepts SMS requests, charges credits, sends through mock providers and fails over to the next provider when one fails. Messages that fail on every provider are refunded.

Stack: Node.js, Express, Prisma, PostgreSQL, JWT.

## Setup

Requires Node.js 20+ and a PostgreSQL database (for example Render).

```bash
npm install
cp .env.example .env
npm run setup
npm start
```

Fill in `.env` first:

- `DATABASE_URL`: your PostgreSQL URL. For Render from your own computer, use the External URL and end it with `?sslmode=require`.
- `JWT_SECRET`: any long random string.

`npm run setup` creates the tables from `prisma/schema.prisma` and seeds three providers. The API runs on `http://localhost:3000`.

To change a wallet, a provider failure rate or a provider balance for testing, run `npx prisma studio`.

## API

| Method | URL | Auth | Body or query |
|---|---|---|---|
| POST | `/auth/register` | no | `{ email, password }` (gives 100 credits) |
| POST | `/auth/login` | no | `{ email, password }` |
| GET | `/wallet` | yes | |
| POST | `/sms/send` | yes | `{ to: ["9841234567"], message: "Hello" }` |
| GET | `/sms/logs` | yes | `status`, `date` (2026-10-27), `number`, `page`, `limit` |
| GET | `/routes/health` | no | |

Authenticated requests need the header `Authorization: Bearer <token>`.


## Decisions

- One invalid number rejects the whole request and nothing is charged.
- A message counts as GSM-7 if every character is ASCII, otherwise Unicode. Length uses `message.length`.
- Sending is done before the response, so the response already shows each message as `sent` or `failed`.
- Provider failure is random: `Math.random() < failureRate`.
- A provider is skipped when its balance is lower than the message parts. Its balance goes down by the parts when a message is sent.
- Tables are created with `prisma db push` from the schema.

## Route health formula

```
successRate  = successes / attempts in the last 24 hours (100 if there were no attempts)
balanceScore = min(balance / 1000, 100%)
health %     = 0.7 x successRate + 0.3 x balanceScore
```

Delivery success counts most (70%) because that is what users care about. Balance counts 30% because a provider with no balance cannot send. A balance of 1000 or more gets the full balance score.

## What I would improve

- Add rate limiting per user.
- Add unit tests for part counting, number validation and failover.
- Add docker compose.

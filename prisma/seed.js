import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const providers = [
  { name: 'ROUTE_A', priority: 1, balance: 10000, failureRate: 0.3 },
  { name: 'ROUTE_B', priority: 2, balance: 10000, failureRate: 0.1 },
  { name: 'ROUTE_C', priority: 3, balance: 10000, failureRate: 0.05 },
];

async function main() {
  for (const provider of providers) {
    await prisma.provider.upsert({
      where: { name: provider.name },
      update: {},
      create: provider,
    });
  }
}

main().finally(() => prisma.$disconnect());

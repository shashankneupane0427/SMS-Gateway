import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function normalizeNumber(input) {
  let number = String(input).trim();

  if (number.startsWith('+977')) {
    number = number.slice(4);
  } else if (number.startsWith('977') && number.length === 13) {
    number = number.slice(3);
  }

  const onlyDigits = number.split('').every((c) => c >= '0' && c <= '9');
  if (number.length !== 10 || !onlyDigits) return null;
  if (!number.startsWith('97') && !number.startsWith('98')) return null;

  return number;
}

export function countParts(message) {
  const isUnicode = message.split('').some((c) => c.charCodeAt(0) > 127);
  const singleLimit = isUnicode ? 70 : 160;
  const partLimit = isUnicode ? 67 : 153;

  if (message.length <= singleLimit) return 1;
  return Math.ceil(message.length / partLimit);
}

export async function getBalance(provider) {
  const row = await prisma.provider.findUnique({ where: { id: provider.id } });
  return row.balance;
}

export function sendWithProvider(provider) {
  return Math.random() >= provider.failureRate;
}

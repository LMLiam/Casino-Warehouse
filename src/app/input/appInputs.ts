import type { CasinoGameId } from '../../game/catalog';
import { creditSchema, positiveCreditSchema, roomGameIdSchema } from '../../schemas/casinoSchemas';

export const readCreditInput = (input: HTMLInputElement, fallback = 0): number => {
  const parsed = creditSchema.safeParse(input.value || fallback);
  return parsed.success ? parsed.data : fallback;
};

export const readPositiveCreditInput = (input: HTMLInputElement, fallback = 0): number => {
  const parsed = positiveCreditSchema.safeParse(input.value || fallback);
  return parsed.success ? parsed.data : fallback;
};

export const inviteServerUrl = (): string | undefined => {
  const params = new URLSearchParams(window.location.search);
  return params.get('server')?.trim() || params.get('ws')?.trim() || undefined;
};

export const parseGameId = (value: unknown): CasinoGameId | undefined => {
  const parsed = roomGameIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

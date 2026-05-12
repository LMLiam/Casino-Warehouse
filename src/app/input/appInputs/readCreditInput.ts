import { creditSchema } from '../../../schemas/casinoSchemas/creditSchema';

export const readCreditInput = (input: HTMLInputElement, fallback = 0): number => {
  const parsed = creditSchema.safeParse(input.value || fallback);
  return parsed.success ? parsed.data : fallback;
};

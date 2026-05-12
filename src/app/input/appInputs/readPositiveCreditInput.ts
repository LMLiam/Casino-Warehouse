import { positiveCreditSchema } from '../../../schemas/casinoSchemas/positiveCreditSchema';

export const readPositiveCreditInput = (input: HTMLInputElement, fallback = 0): number => {
  const parsed = positiveCreditSchema.safeParse(input.value || fallback);
  return parsed.success ? parsed.data : fallback;
};

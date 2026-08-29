import type { HexColour } from '../../schemas/casinoSchemas/HexColour';
import { hexColourSchema } from '../../schemas/casinoSchemas/hexColourSchema';

export const profileColorFromName = (name: string): HexColour => {
  const colors = ['#ffd56b', '#75ff92', '#26f0ff', '#ff8ac6', '#b48cff', '#ffb13b'] as const;
  const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const color = colors[total % colors.length];
  return hexColourSchema.parse(color);
};

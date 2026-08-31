import type { Card } from '../cards/Card';
import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import { cardSchema } from '../../schemas/casinoSchemas/cardSchema';

export const isCard = (card: Card | JsonValue): card is Card => cardSchema.safeParse(card).success;

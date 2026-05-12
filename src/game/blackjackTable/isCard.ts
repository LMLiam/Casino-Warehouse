import type { Card } from '../cards/Card';
import { ranks } from '../cards/ranks';
import { suits } from '../cards/suits';

export const isCard = (card: unknown): card is Card =>
  typeof card === 'object' &&
  card !== null &&
  'suit' in card &&
  'rank' in card &&
  suits.includes(card.suit as Card['suit']) &&
  ranks.includes(card.rank as Card['rank']);

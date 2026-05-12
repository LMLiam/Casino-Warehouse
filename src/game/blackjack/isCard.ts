import type { Card } from '../cards/Card';
import { ranks } from '../cards/ranks';
import { suits } from '../cards/suits';

export const isCard = (card: Card): card is Card => suits.includes(card.suit) && ranks.includes(card.rank);

import { beatTheHouseRules } from '../beatTheHouseRules';
import type { Card } from '../../cards/Card';
import { ranks } from '../../cards/ranks';
import { suits } from '../../cards/suits';

export const createBeatTheHouseShoeCards = (): Card[] =>
  Array.from({ length: beatTheHouseRules.deckCount }, () => suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })))).flat();

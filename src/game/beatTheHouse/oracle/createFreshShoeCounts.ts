import { beatTheHouseRules } from '../beatTheHouseRules';
import type { FreshShoeCounts } from './FreshShoeCounts';
import { freshShoeCardKinds } from './freshShoeCardKinds';

export const createFreshShoeCounts = (): FreshShoeCounts => freshShoeCardKinds.map((kind) => kind.copiesPerDeck * beatTheHouseRules.deckCount);

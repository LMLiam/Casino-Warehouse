import type { GameEvent } from '../../game/types/GameEvent';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import { handLayouts } from '../layout/handLayouts';

export const roundStartAnimationKey = (snapshot: GameSnapshot): string => {
  const cardSignature = (card: GameEvent['card']): string => (card ? `${card.rank}-${card.suit}` : '');

  if (!snapshot.lastEvents.some((event) => event.type === 'round-started')) {
    return '';
  }

  return JSON.stringify({
    bets: handLayouts.map((hand) => [hand.id, snapshot.bets[hand.id].main]),
    hands: handLayouts.map((hand) => [
      hand.id,
      snapshot.hands[hand.id].cards.map(cardSignature),
      snapshot.hands[hand.id].result ?? '',
      snapshot.hands[hand.id].done,
    ]),
    dealer: {
      cards: snapshot.dealer.cards.map(cardSignature),
      holeRevealed: snapshot.dealer.holeRevealed,
    },
    events: snapshot.lastEvents.map((event) => [
      event.type,
      event.handId ?? '',
      event.cardIndex ?? '',
      event.card ? cardSignature(event.card) : '',
      event.totalProfit ?? '',
    ]),
  });
};

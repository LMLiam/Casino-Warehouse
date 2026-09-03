import { cardLabel } from '../cards/cardLabel';
import { isBlackAce } from '../cards/isBlackAce';
import { rankValue } from '../cards/rankValue';
import type { GameEvent } from '../types/GameEvent';
import type { GameSnapshot } from '../types/GameSnapshot';
import { handIds } from '../types/handIds';
import { sideBetTypes } from '../types/sideBetTypes';
import { BeatTheHouseBetting } from './BeatTheHouseBetting';
import { BeatTheHouseState } from './BeatTheHouseState';

export abstract class BeatTheHouseRound extends BeatTheHouseBetting {
  public deal(): GameSnapshot {
    if (this.phase !== 'betting') {
      return this.snapshot();
    }

    const active = BeatTheHouseState.playableHands(this.bets);
    if (active.length === 0) {
      return this.emit([{ type: 'message', message: 'Place a main bet on at least one hand.' }], 'Place a main bet on at least one hand.');
    }

    const orphanedSideBet = handIds.some((handId) => this.bets[handId].main === 0 && sideBetTypes.some((betType) => this.bets[handId][betType] > 0));
    if (orphanedSideBet) {
      return this.emit([{ type: 'message', message: 'Side bets need a main bet on the same hand.' }], 'Side bets need a main bet on the same hand.');
    }

    const shoeEvents = this.prepareShoeForDeal();
    this.phase = 'dealing';
    this.lastBets = BeatTheHouseState.cloneBets(this.bets);
    this.dealerTipRewards = BeatTheHouseState.emptyDealerTips();
    this.hands = BeatTheHouseState.emptyHands();
    this.dealer = { cards: [], holeRevealed: false, bust: false, blackAce: false };
    this.sideStates = BeatTheHouseState.emptySideStates();
    this.summaries = [];

    const events: GameEvent[] = [
      ...shoeEvents,
      ...handIds.flatMap((handId): GameEvent[] => (this.dealerTips[handId] > 0 ? [{ type: 'dealer-tip-taken', handId, amount: this.dealerTips[handId] }] : [])),
      { type: 'round-started', message: 'Round started.' },
    ];
    for (const handId of active) {
      const card = this.draw(events);
      const current = this.hands[handId];
      const nextHand = { ...current, cards: [card], finalCard: card };

      if (card.rank === '2') {
        this.hands[handId] = { ...nextHand, done: true, result: 'lose', finalCard: undefined };
        events.push(
          { type: 'player-card', handId, card, cardIndex: 0 },
          {
            type: 'hand-completed',
            handId,
            result: 'lose',
            message: `${BeatTheHouseState.handName[handId]} first card ${cardLabel(card)} is an instant loss.`,
          },
        );
      } else if (isBlackAce(card)) {
        this.hands[handId] = { ...nextHand, done: true, result: 'win', automaticWin: true };
        events.push(
          { type: 'player-card', handId, card, cardIndex: 0 },
          { type: 'hand-completed', handId, result: 'win', message: `${BeatTheHouseState.handName[handId]} first-card black Ace wins automatically.` },
        );
      } else {
        this.hands[handId] = nextHand;
        events.push({ type: 'player-card', handId, card, cardIndex: 0 });
      }
    }

    this.dealer = { ...this.dealer, holeCard: this.draw(events), holeRevealed: false };
    events.push({ type: 'dealer-hole', message: 'Dealer receives one face-down card.' });
    this.activeHand = BeatTheHouseState.nextPlayableHand(this.bets, this.hands);

    if (this.activeHand) {
      const activeHandId = this.activeHand;
      const activeHandSnapshot = this.hands[activeHandId];
      const lastCard = activeHandSnapshot?.cards.at(-1);
      if (!lastCard) {
        throw new Error('Active hand has no cards.');
      }
      this.phase = 'playing';
      this.status = `${BeatTheHouseState.handName[activeHandId]} hand: ${cardLabel(lastCard)}. Hit or stick.`;
    } else {
      return this.playDealer(events);
    }

    return this.snapshot(events);
  }

  public hit(): GameSnapshot {
    if (this.phase !== 'playing' || !this.activeHand) {
      return this.snapshot();
    }

    const handId = this.activeHand;
    const hand = this.hands[handId];
    const events: GameEvent[] = [];
    const card = this.draw(events);
    const cards = [...hand.cards, card];
    events.push({ type: 'player-card', handId, card, cardIndex: cards.length - 1 });

    if (card.rank === '2') {
      this.hands[handId] = { ...hand, cards, done: true, result: 'lose', finalCard: undefined };
      events.push({ type: 'hand-completed', handId, result: 'lose', message: `${BeatTheHouseState.handName[handId]} busted on a 2.` });
      return this.advanceFromPlayer(events);
    }

    if (cards.length >= BeatTheHouseState.maxPlayerCards) {
      this.hands[handId] = { ...hand, cards, done: true, finalCard: card };
      events.push({ type: 'hand-completed', handId, message: `${BeatTheHouseState.handName[handId]} reaches four cards and stands on ${cardLabel(card)}.` });
      return this.advanceFromPlayer(events);
    }

    this.hands[handId] = { ...hand, cards, finalCard: card };
    return this.emit(events, `${BeatTheHouseState.handName[handId]} hand: ${cardLabel(card)}. Hit or stick.`);
  }

  public stick(): GameSnapshot {
    if (this.phase !== 'playing' || !this.activeHand) {
      return this.snapshot();
    }

    const handId = this.activeHand;
    const hand = this.hands[handId];
    const finalCard = hand.cards.at(-1);
    if (!finalCard) {
      return this.snapshot();
    }
    this.hands[handId] = { ...hand, done: true, finalCard };

    return this.advanceFromPlayer([{ type: 'hand-completed', handId, message: `${BeatTheHouseState.handName[handId]} sticks on ${cardLabel(finalCard)}.` }]);
  }

  public nextRound(): GameSnapshot {
    if (this.phase !== 'roundOver') {
      return this.snapshot();
    }

    this.bets = BeatTheHouseState.emptyBets();
    this.dealerTips = BeatTheHouseState.emptyDealerTips();
    this.dealerTipRewards = BeatTheHouseState.emptyDealerTips();
    this.hands = BeatTheHouseState.emptyHands();
    this.dealer = { cards: [], holeRevealed: false, bust: false, blackAce: false };
    this.activeHand = undefined;
    this.sideStates = BeatTheHouseState.emptySideStates();
    this.summaries = [];
    this.phase = 'betting';
    return this.emit([{ type: 'message', message: 'New round ready.' }], 'Place chips on any hand, then deal.');
  }

  protected abstract settle(previousEvents: GameEvent[]): GameSnapshot;

  private advanceFromPlayer(events: GameEvent[]): GameSnapshot {
    const next = BeatTheHouseState.nextPlayableHand(this.bets, this.hands, this.activeHand);
    this.activeHand = next;

    if (!next) {
      return this.playDealer(events);
    }

    const nextHand = this.hands[next];
    const nextCard = nextHand?.cards.at(-1);
    if (!nextCard) {
      throw new Error('Next hand has no cards.');
    }
    return this.emit(events, `${BeatTheHouseState.handName[next]} hand: ${cardLabel(nextCard)}. Hit or stick.`);
  }

  private playDealer(previousEvents: GameEvent[]): GameSnapshot {
    this.phase = 'dealer';
    this.activeHand = undefined;
    const events = [...previousEvents];
    const firstCard = this.dealer.holeCard ?? this.draw(events);
    this.dealer = { ...this.dealer, cards: [firstCard], holeCard: undefined, holeRevealed: true, finalCard: firstCard };
    events.push({ type: 'dealer-card', card: firstCard, cardIndex: 0, message: `Dealer reveals ${cardLabel(firstCard)}.` });

    if (isBlackAce(firstCard)) {
      this.dealer = { ...this.dealer, blackAce: true };
      events.push({ type: 'message', message: 'Dealer first-card black Ace.' });
      return this.settle(events);
    }

    if (firstCard.rank === '2') {
      this.dealer = { ...this.dealer, bust: true, finalCard: undefined };
      events.push({ type: 'message', message: 'Dealer busts on a 2.' });
      return this.settle(events);
    }

    while (
      this.dealer.finalCard &&
      rankValue(this.dealer.finalCard.rank) <= BeatTheHouseState.dealerDrawMaxRank &&
      this.dealer.cards.length < BeatTheHouseState.maxDealerCards
    ) {
      const card = this.draw(events);
      const cards = [...this.dealer.cards, card];
      this.dealer = { ...this.dealer, cards, finalCard: card };
      events.push({ type: 'dealer-card', card, cardIndex: cards.length - 1, message: `Dealer hits ${cardLabel(card)}.` });

      if (card.rank === '2') {
        this.dealer = { ...this.dealer, bust: true, finalCard: undefined };
        events.push({ type: 'message', message: 'Dealer busts on a 2.' });
        break;
      }
    }

    return this.settle(events);
  }
}

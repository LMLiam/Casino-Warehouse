import type { Card } from '../../cards/Card';
import { beatTheHouseRules } from '../beatTheHouseRules';
import type { BeatTheHouseShoeSaveState } from './BeatTheHouseShoeSaveState';
import type { BeatTheHouseShoeSnapshot } from './BeatTheHouseShoeSnapshot';
import { validateBeatTheHouseShoeSaveState } from './validateBeatTheHouseShoeSaveState';

export class BeatTheHouseShoe {
  private readonly totalCards: BeatTheHouseShoeSnapshot['totalCards'];
  private readonly cutThresholdCardsDealt: number;
  private remainingCards: Card[];
  private shufflePending: boolean;

  public constructor(state: BeatTheHouseShoeSaveState) {
    validateBeatTheHouseShoeSaveState(state);
    this.remainingCards = [...state.remainingCards];
    this.totalCards = beatTheHouseRules.cardsPerShoe;
    this.cutThresholdCardsDealt = state.cutThresholdCardsDealt;
    this.shufflePending = state.shufflePending;
  }

  public static fromSaveState(state: BeatTheHouseShoeSaveState): BeatTheHouseShoe {
    return new BeatTheHouseShoe(state);
  }

  public draw(): Card {
    const card = this.remainingCards.pop();
    if (!card) {
      throw new Error('Beat the House shoe exhausted.');
    }
    if (this.cardsDealt() >= this.cutThresholdCardsDealt) {
      this.shufflePending = true;
    }
    return card;
  }

  public snapshot(): BeatTheHouseShoeSnapshot {
    return {
      cardsRemaining: this.remainingCards.length,
      cardsDealt: this.cardsDealt(),
      totalCards: this.totalCards,
      cutCardReached: this.shufflePending,
    };
  }

  public saveState(): BeatTheHouseShoeSaveState {
    return {
      remainingCards: [...this.remainingCards],
      totalCards: this.totalCards,
      cutThresholdCardsDealt: this.cutThresholdCardsDealt,
      shufflePending: this.shufflePending,
    };
  }

  private cardsDealt(): number {
    return this.totalCards - this.remainingCards.length;
  }
}

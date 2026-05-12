import type { Card } from '../cards/Card';
import { cardLabel } from '../cards/cardLabel';
import { createDeck } from '../cards/createDeck';
import type { Rng } from '../rng/Rng';
import { bestTotal } from './bestTotal';
import type { BlackjackOptions } from './BlackjackOptions';
import type { BlackjackPhase } from './BlackjackPhase';
import type { BlackjackResult } from './BlackjackResult';
import type { BlackjackSnapshot } from './BlackjackSnapshot';
import { dealerMustHit } from './dealerMustHit';
import { handText } from './handText';
import { isBlackjack } from './isBlackjack';
import { isCard } from './isCard';

export class BlackjackGame {
  private deck: Card[];
  private phase: BlackjackPhase = 'idle';
  private wager = 0;
  private playerCards: Card[] = [];
  private dealerCards: Card[] = [];
  private dealerHoleHidden = false;
  private insuranceWager = 0;
  private splitHands: readonly (readonly Card[])[] = [];
  private result?: BlackjackResult;
  private returned = 0;
  private status = 'Choose a wager and deal Blackjack.';
  private readonly rng?: Rng;

  public constructor(options: BlackjackOptions = {}) {
    this.rng = options.rng;
    this.deck = options.deck ? [...options.deck] : createDeck(this.rng);
  }

  public snapshot(): BlackjackSnapshot {
    return {
      phase: this.phase,
      wager: this.wager,
      playerCards: [...this.playerCards],
      dealerCards: [...this.dealerCards],
      dealerHoleHidden: this.dealerHoleHidden,
      insuranceWager: this.insuranceWager,
      splitHands: this.splitHands.map((hand) => [...hand]),
      result: this.result,
      returned: this.returned,
      status: this.status,
    };
  }

  public restore(snapshot: BlackjackSnapshot): BlackjackSnapshot {
    this.phase = snapshot.phase;
    this.wager = Math.max(0, Math.floor(snapshot.wager));
    this.playerCards = snapshot.playerCards.filter(isCard);
    this.dealerCards = snapshot.dealerCards.filter(isCard);
    this.dealerHoleHidden = snapshot.dealerHoleHidden;
    this.insuranceWager = Math.max(0, Math.floor(snapshot.insuranceWager ?? 0));
    this.splitHands = Array.isArray(snapshot.splitHands) ? snapshot.splitHands.map((hand) => hand.filter(isCard)) : [];
    this.result = snapshot.result;
    this.returned = Math.max(0, Math.floor(snapshot.returned));
    this.status = snapshot.status || 'Choose a wager and deal Blackjack.';
    return this.snapshot();
  }

  public deal(wager: number, deckOverride?: Card[]): BlackjackSnapshot {
    if (this.phase === 'player' || this.phase === 'dealer') {
      return this.snapshot();
    }

    this.deck = deckOverride ? [...deckOverride] : createDeck(this.rng);
    this.phase = 'player';
    this.wager = Math.floor(wager);
    this.playerCards = [this.draw(), this.draw()];
    this.dealerCards = [this.draw(), this.draw()];
    this.dealerHoleHidden = true;
    this.insuranceWager = 0;
    this.splitHands = [];
    this.result = undefined;
    this.returned = 0;

    const playerBlackjack = isBlackjack(this.playerCards);
    const dealerBlackjack = isBlackjack(this.dealerCards);
    if (playerBlackjack || dealerBlackjack) {
      this.dealerHoleHidden = false;
      if (playerBlackjack && dealerBlackjack) {
        return this.settle('push', this.wager, 'Both players have Blackjack. Push.');
      }
      if (playerBlackjack) {
        return this.settle('blackjack', this.wager + Math.floor(this.wager * 1.5), 'Blackjack pays 3:2.');
      }
      return this.settle('lose', 0, `Dealer has Blackjack with ${cardLabel(this.dealerCards[1])}.`);
    }

    this.status = `Player ${handText(this.playerCards)}. Hit or stand.`;
    return this.snapshot();
  }

  public hit(): BlackjackSnapshot {
    if (this.phase !== 'player') {
      return this.snapshot();
    }

    this.playerCards = [...this.playerCards, this.draw()];
    const total = bestTotal(this.playerCards);
    if (total > 21) {
      this.dealerHoleHidden = false;
      return this.settle('lose', 0, `Player busts with ${total}.`);
    }

    if (this.playerCards.length >= 5) {
      return this.stand();
    }

    this.status = `Player ${handText(this.playerCards)}. Hit or stand.`;
    return this.snapshot();
  }

  public double(): BlackjackSnapshot {
    if (this.phase !== 'player' || this.playerCards.length !== 2) {
      return this.snapshot();
    }
    this.wager *= 2;
    this.playerCards = [...this.playerCards, this.draw()];
    if (bestTotal(this.playerCards) > 21) {
      this.dealerHoleHidden = false;
      return this.settle('lose', 0, `Double busts with ${bestTotal(this.playerCards)}.`);
    }
    return this.stand();
  }

  public split(): BlackjackSnapshot {
    if (this.phase !== 'player' || this.playerCards.length !== 2 || this.playerCards[0].rank !== this.playerCards[1].rank) {
      return this.snapshot();
    }
    const first = [this.playerCards[0], this.draw()];
    const second = [this.playerCards[1], this.draw()];
    this.splitHands = [first, second];
    this.wager *= 2;
    this.phase = 'dealer';
    this.dealerHoleHidden = false;
    while (dealerMustHit(this.dealerCards)) {
      this.dealerCards = [...this.dealerCards, this.draw()];
    }
    const dealerTotal = bestTotal(this.dealerCards);
    const returned = this.splitHands.reduce((sum, hand) => {
      const total = bestTotal(hand);
      if (total > 21) {
        return sum;
      }
      if (dealerTotal > 21 || total > dealerTotal) {
        return sum + this.wager;
      }
      if (total === dealerTotal) {
        return sum + this.wager / 2;
      }
      return sum;
    }, 0);
    const result: BlackjackResult = returned > this.wager ? 'win' : returned === this.wager ? 'push' : 'lose';
    return this.settle(result, Math.floor(returned), `Split hands settle against dealer ${dealerTotal}.`);
  }

  public insurance(amount: number): BlackjackSnapshot {
    if (this.phase !== 'player' || this.dealerCards[0]?.rank !== 'A') {
      return this.snapshot();
    }
    this.insuranceWager = Math.max(0, Math.floor(amount));
    if (isBlackjack(this.dealerCards)) {
      this.dealerHoleHidden = false;
      return this.settle('lose', this.insuranceWager * 3, 'Insurance pays 2:1 against dealer Blackjack.');
    }
    this.status = 'Insurance placed. Dealer does not have Blackjack.';
    return this.snapshot();
  }

  public stand(): BlackjackSnapshot {
    if (this.phase !== 'player') {
      return this.snapshot();
    }

    this.phase = 'dealer';
    this.dealerHoleHidden = false;
    this.insuranceWager = 0;
    this.splitHands = [];
    while (dealerMustHit(this.dealerCards)) {
      this.dealerCards = [...this.dealerCards, this.draw()];
    }

    const playerTotal = bestTotal(this.playerCards);
    const dealerTotal = bestTotal(this.dealerCards);
    if (dealerTotal > 21) {
      return this.settle('win', this.wager * 2, `Dealer busts with ${dealerTotal}.`);
    }
    if (playerTotal > dealerTotal) {
      return this.settle('win', this.wager * 2, `${playerTotal} beats dealer ${dealerTotal}.`);
    }
    if (playerTotal === dealerTotal) {
      return this.settle('push', this.wager, `${playerTotal} pushes dealer ${dealerTotal}.`);
    }

    return this.settle('lose', 0, `Dealer ${dealerTotal} beats ${playerTotal}.`);
  }

  public reset(): BlackjackSnapshot {
    this.phase = 'idle';
    this.wager = 0;
    this.playerCards = [];
    this.dealerCards = [];
    this.dealerHoleHidden = false;
    this.result = undefined;
    this.returned = 0;
    this.status = 'Choose a wager and deal Blackjack.';
    return this.snapshot();
  }

  private settle(result: BlackjackResult, returned: number, status: string): BlackjackSnapshot {
    this.phase = 'settled';
    this.result = result;
    this.returned = Math.floor(returned);
    this.status = status;
    return this.snapshot();
  }

  private draw(): Card {
    const card = this.deck.pop();
    if (!card) {
      throw new Error('Blackjack deck exhausted.');
    }
    return card;
  }
}

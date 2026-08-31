import { blackjackTableAsset } from '../../assets/manifest/blackjackTableAsset';
import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import type { BlackjackTableSeatSnapshot } from '../../game/blackjackTable/BlackjackTableSeatSnapshot';
import type { BlackjackTableSnapshot } from '../../game/blackjackTable/BlackjackTableSnapshot';
import { isBlackjackTableSnapshot } from '../../game/blackjackTable/isBlackjackTableSnapshot';
import type { Card } from '../../game/cards/Card';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { AppElements } from '../dom/appElements/AppElements';
import { money } from '../format/appMoney';
import { capitalize } from '../format/appText';

export class BlackjackView {
  public constructor(private readonly elements: AppElements) {}

  public render(snapshot: BlackjackSnapshot | BlackjackTableSnapshot, profileId?: ProfileId): void {
    this.elements.blackjackView.style.setProperty('--blackjack-table-art', `url('${blackjackTableAsset().path}')`);
    if (isBlackjackTableSnapshot(snapshot)) {
      this.renderTable(snapshot, profileId);
      return;
    }
    this.renderSolo(snapshot);
  }

  private renderSolo(snapshot: BlackjackSnapshot): void {
    this.elements.blackjackStatus.textContent = snapshot.status;
    this.renderCards(this.elements.blackjackPlayerCards, snapshot.playerCards);
    this.renderDealerCards(snapshot.dealerCards, snapshot.dealerHoleHidden);
    this.elements.blackjackResult.textContent = snapshot.result ? `${snapshot.result.toUpperCase()} • Returned ${money(snapshot.returned)}` : '';
    this.setActionButton(this.elements.blackjackDealButton, snapshot.phase !== 'player' && snapshot.phase !== 'dealer');
    this.setActionButton(this.elements.blackjackHitButton, snapshot.phase === 'player');
    this.setActionButton(this.elements.blackjackStandButton, snapshot.phase === 'player');
    this.setActionButton(this.elements.blackjackDoubleButton, snapshot.phase === 'player' && snapshot.playerCards.length === 2);
    this.setActionButton(
      this.elements.blackjackSplitButton,
      snapshot.phase === 'player' && snapshot.playerCards.length === 2 && snapshot.playerCards[0]?.rank === snapshot.playerCards[1]?.rank,
    );
    this.setActionButton(this.elements.blackjackInsuranceButton, snapshot.phase === 'player' && snapshot.dealerCards[0]?.rank === 'A');
    this.setActionButton(this.elements.blackjackNewButton, snapshot.phase === 'settled');
    this.elements.blackjackSeats.replaceChildren();
  }

  private renderTable(snapshot: BlackjackTableSnapshot, profileId?: ProfileId): void {
    const mySeat = snapshot.seats.find((seat) => seat.profileId === profileId);
    this.elements.blackjackStatus.textContent = snapshot.status;
    this.renderDealerCards(snapshot.dealerCards, snapshot.dealerHoleHidden);
    this.renderCards(this.elements.blackjackPlayerCards, mySeat?.playerCards ?? []);
    this.elements.blackjackResult.textContent = mySeat
      ? `${capitalize(mySeat.seatId)} • ${mySeat.result ? `${mySeat.result.toUpperCase()} • Returned ${money(mySeat.returned)}` : mySeat.status}`
      : 'Spectating this Blackjack table.';
    this.elements.blackjackSeats.replaceChildren(...snapshot.seats.map((seat) => this.renderTableSeat(seat, profileId)));
    const canAct = Boolean(mySeat?.isTurn);
    const canDeal = Boolean(
      mySeat && (mySeat.phase === 'empty' || mySeat.phase === 'betting') && mySeat.playerCards.length === 0 && snapshot.phase !== 'settled',
    );
    this.setActionButton(this.elements.blackjackDealButton, canDeal);
    this.setActionButton(this.elements.blackjackHitButton, canAct);
    this.setActionButton(this.elements.blackjackStandButton, canAct);
    this.setActionButton(this.elements.blackjackDoubleButton, canAct && (mySeat?.playerCards.length ?? 0) === 2);
    this.setActionButton(
      this.elements.blackjackSplitButton,
      canAct && (mySeat?.playerCards.length ?? 0) === 2 && mySeat?.playerCards[0]?.rank === mySeat?.playerCards[1]?.rank,
    );
    this.setActionButton(this.elements.blackjackInsuranceButton, canAct && snapshot.dealerCards[0]?.rank === 'A' && (mySeat?.insuranceWager ?? 0) <= 0);
    this.setActionButton(this.elements.blackjackNewButton, snapshot.phase === 'settled');
  }

  private renderTableSeat(seat: BlackjackTableSeatSnapshot, profileId?: ProfileId): HTMLElement {
    const seatElement = document.createElement('article');
    seatElement.classList.add('blackjack-table-seat');
    seatElement.classList.toggle('active', seat.isTurn);
    seatElement.classList.toggle('mine', seat.profileId === profileId);
    seatElement.dataset.blackjackSeat = seat.seatId;

    const label = document.createElement('span');
    label.textContent = capitalize(seat.seatId);

    const profile = document.createElement('b');
    profile.textContent = seat.profileName ?? 'Open';

    const cards = document.createElement('div');
    cards.className = 'seat-cards';
    this.renderSeatHands(cards, seat.playerCards, seat.splitHands);

    const wager = document.createElement('small');
    wager.textContent = seat.wager > 0 ? `Wager ${money(seat.wager)}` : seat.profileName ? 'No wager yet' : 'Available';

    const status = document.createElement('strong');
    status.textContent = `${seat.isTurn ? 'TURN • ' : ''}${seat.result ? `${seat.result.toUpperCase()} ${money(seat.returned)}` : seat.status}`;

    seatElement.append(label, profile, cards, wager, status);
    return seatElement;
  }

  private renderDealerCards(cards: readonly Card[], dealerHoleHidden: boolean): void {
    if (!dealerHoleHidden) {
      this.renderCards(this.elements.blackjackDealerCards, cards);
      return;
    }

    this.elements.blackjackDealerCards.replaceChildren(...this.cardElements(cards.slice(0, 1)), this.backCardElement());
  }

  private renderCards(container: HTMLElement, cards: readonly Card[]): void {
    container.replaceChildren(...this.cardElements(cards));
  }

  private renderSeatHands(container: HTMLElement, playerCards: readonly Card[], splitHands: readonly (readonly Card[])[]): void {
    const hands = splitHands.length > 0 ? splitHands : [playerCards];
    container.replaceChildren(
      ...hands.map((hand) => {
        const handElement = document.createElement('div');
        handElement.className = 'seat-hand';
        handElement.replaceChildren(...this.cardElements(hand));
        return handElement;
      }),
    );
  }

  private cardElements(cards: readonly Card[]): HTMLElement[] {
    if (cards.length === 0) {
      return [this.emptyCardElement()];
    }
    return cards.map((card) => {
      const red = card.suit === 'hearts' || card.suit === 'diamonds';
      const cardElement = document.createElement('span');
      cardElement.classList.add('playing-card', red ? 'red' : 'black');

      const rank = document.createElement('b');
      rank.textContent = card.rank;

      const suit = document.createElement('em');
      suit.textContent = this.suitSymbol(card.suit);

      cardElement.append(rank, suit);
      return cardElement;
    });
  }

  private emptyCardElement(): HTMLElement {
    const card = document.createElement('span');
    card.className = 'playing-card empty';
    card.textContent = '-';
    return card;
  }

  private backCardElement(): HTMLElement {
    const card = document.createElement('span');
    card.className = 'playing-card back';
    card.textContent = '?';
    return card;
  }

  private suitSymbol(suit: string): string {
    return (
      {
        spades: '♠',
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
      }[suit] ?? ''
    );
  }

  private setActionButton(button: HTMLButtonElement, visible: boolean): void {
    button.disabled = !visible;
    button.classList.toggle('hidden', !visible);
  }
}

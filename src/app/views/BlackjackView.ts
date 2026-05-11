import { blackjackTableAsset } from '../../assets/manifest';
import type { BlackjackSnapshot } from '../../game/blackjack';
import { isBlackjackTableSnapshot, type BlackjackTableSnapshot } from '../../game/blackjackTable';
import type { Card } from '../../game/cards';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements';
import { money } from '../format/appMoney';
import { capitalize } from '../format/appText';

export class BlackjackView {
  public constructor(private readonly elements: AppElements) {}

  public render(snapshot: BlackjackSnapshot | BlackjackTableSnapshot, profileId?: string): void {
    this.elements.blackjackView.style.setProperty('--blackjack-table-art', `url('${blackjackTableAsset().path}')`);
    if (isBlackjackTableSnapshot(snapshot)) {
      this.renderTable(snapshot, profileId);
      return;
    }
    this.renderSolo(snapshot);
  }

  private renderSolo(snapshot: BlackjackSnapshot): void {
    this.elements.blackjackStatus.textContent = snapshot.status;
    this.elements.blackjackPlayerCards.innerHTML = this.renderCards(snapshot.playerCards);
    this.elements.blackjackDealerCards.innerHTML = snapshot.dealerHoleHidden
      ? `${this.renderCards(snapshot.dealerCards.slice(0, 1))}<span class="playing-card back">?</span>`
      : this.renderCards(snapshot.dealerCards);
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
    this.elements.blackjackSeats.innerHTML = '';
  }

  private renderTable(snapshot: BlackjackTableSnapshot, profileId?: string): void {
    const mySeat = snapshot.seats.find((seat) => seat.profileId === profileId);
    this.elements.blackjackStatus.textContent = snapshot.status;
    this.elements.blackjackDealerCards.innerHTML = snapshot.dealerHoleHidden
      ? `${this.renderCards(snapshot.dealerCards.slice(0, 1))}<span class="playing-card back">?</span>`
      : this.renderCards(snapshot.dealerCards);
    this.elements.blackjackPlayerCards.innerHTML = this.renderCards(mySeat?.playerCards ?? []);
    this.elements.blackjackResult.textContent = mySeat
      ? `${capitalize(mySeat.seatId)} • ${mySeat.result ? `${mySeat.result.toUpperCase()} • Returned ${money(mySeat.returned)}` : mySeat.status}`
      : 'Spectating this Blackjack table.';
    this.elements.blackjackSeats.innerHTML = snapshot.seats
      .map(
        (seat) => `
          <article class="blackjack-table-seat ${seat.isTurn ? 'active' : ''} ${seat.profileId === profileId ? 'mine' : ''}" data-blackjack-seat="${escapeHtml(seat.seatId)}">
            <span>${escapeHtml(capitalize(seat.seatId))}</span>
            <b>${escapeHtml(seat.profileName ?? 'Open')}</b>
            <div class="seat-cards">${this.renderSeatHands(seat.playerCards, seat.splitHands)}</div>
            <small>${seat.wager > 0 ? `Wager ${money(seat.wager)}` : seat.profileName ? 'No wager yet' : 'Available'}</small>
            <strong>${seat.isTurn ? 'TURN • ' : ''}${seat.result ? `${seat.result.toUpperCase()} ${money(seat.returned)}` : escapeHtml(seat.status)}</strong>
          </article>
        `,
      )
      .join('');
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

  private renderCards(cards: readonly Card[]): string {
    return cards.length > 0
      ? cards
          .map((card) => {
            const red = card.suit === 'hearts' || card.suit === 'diamonds';
            return `<span class="playing-card ${red ? 'red' : 'black'}"><b>${escapeHtml(card.rank)}</b><em>${this.suitSymbol(card.suit)}</em></span>`;
          })
          .join('')
      : '<span class="playing-card empty">-</span>';
  }

  private renderSeatHands(playerCards: readonly Card[], splitHands: readonly (readonly Card[])[]): string {
    const hands = splitHands.length > 0 ? splitHands : [playerCards];
    return hands.map((hand) => `<div class="seat-hand">${this.renderCards(hand)}</div>`).join('');
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

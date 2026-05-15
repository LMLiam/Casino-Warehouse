import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { HandId } from '../../game/types/HandId';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import { escapeHtml } from '../../shared/html';
import { handLayouts } from '../../ui/layout/handLayouts';
import { tableSize } from '../../ui/layout/tableSize';
import type { AppElements } from '../dom/appElements/AppElements';
import { money } from '../format/appMoney';
import { capitalize } from '../format/appText';

export class BeatSeatStatusView {
  private static readonly seatPillVerticalOffsetPercent = 2.5;

  public constructor(private readonly elements: AppElements) {}

  public clear(): void {
    this.elements.beatSeatStatus.innerHTML = '';
  }

  public render(snapshot: GameSnapshot, room: RoomSnapshot | undefined, profileId: string, onClaimSeat?: (seatId: HandId) => void): void {
    this.layout();
    if (!room || room.gameId !== 'beat-the-house') {
      this.clear();
      return;
    }

    const currentProfileHasSeat = room.seats.some((seat) => seat.profileId === profileId);
    const currentProfileCanClaimSeat = Boolean(onClaimSeat) && !currentProfileHasSeat && room.spectators.some((spectator) => spectator.profileId === profileId);
    this.elements.beatSeatStatus.innerHTML = handLayouts
      .map((hand) => {
        const seat = room.seats.find((candidate) => candidate.seatId === hand.id);
        const owner = seat?.profileId ? room.players.find((candidate) => candidate.profileId === seat.profileId) : undefined;
        const handSnapshot = snapshot.hands[hand.id];
        const mainBet = snapshot.bets[hand.id].main;
        const status = owner
          ? snapshot.activeHand === hand.id
            ? 'Playing'
            : snapshot.phase === 'betting'
              ? mainBet > 0
                ? 'Ready'
                : 'Betting'
              : handSnapshot.result
                ? capitalize(handSnapshot.result)
                : 'Waiting'
          : 'Open';
        const mine = owner?.profileId === profileId ? ' mine' : '';
        const occupied = owner ? ' occupied' : '';
        const sessionDelta = owner ? owner.bankroll - owner.sessionStartBankroll : 0;
        const deltaClass = sessionDelta > 0 ? ' gain' : sessionDelta < 0 ? ' loss' : '';
        const deltaText = sessionDelta === 0 ? 'even' : `${sessionDelta > 0 ? '+' : '-'}${money(Math.abs(sessionDelta))}`;
        const content = owner
          ? `
            <b>${escapeHtml(owner.profileName)}</b>
            <small class="seat-bankroll">${money(owner.bankroll)} <span class="session-delta${deltaClass}">(${escapeHtml(deltaText)})</span></small>
            <small class="seat-state">${escapeHtml(status)}</small>
          `
          : `
            <b>${escapeHtml(capitalize(hand.id))}</b>
            <small class="seat-state">${escapeHtml(status)}</small>
          `;
        if (!owner && currentProfileCanClaimSeat && room.players.length < room.maxPlayers) {
          return `
            <button type="button" class="seat-status-pill claimable" data-claim-seat="${hand.id}" style="left: ${hand.zones.main.x}%; top: ${hand.zones.main.y + hand.zones.main.height / 2 + BeatSeatStatusView.seatPillVerticalOffsetPercent}%" aria-label="Claim ${capitalize(hand.id)} seat">
              ${content}
            </button>
          `;
        }
        return `
          <span class="seat-status-pill${occupied}${mine}" style="left: ${hand.zones.main.x}%; top: ${hand.zones.main.y + hand.zones.main.height / 2 + BeatSeatStatusView.seatPillVerticalOffsetPercent}%">
            ${content}
          </span>
        `;
      })
      .join('');
    this.elements.beatSeatStatus.querySelectorAll<HTMLButtonElement>('[data-claim-seat]').forEach((button) => {
      button.addEventListener('click', () => onClaimSeat?.(button.dataset.claimSeat as HandId));
    });
  }

  public layout(): void {
    const { tableHost, beatSeatStatus } = this.elements;
    if (tableHost.clientWidth <= 0 || tableHost.clientHeight <= 0) {
      return;
    }

    const scale = Math.min(tableHost.clientWidth / tableSize.width, tableHost.clientHeight / tableSize.height);
    const width = tableSize.width * scale;
    const height = tableSize.height * scale;
    beatSeatStatus.style.width = `${width}px`;
    beatSeatStatus.style.height = `${height}px`;
    beatSeatStatus.style.left = `${(tableHost.clientWidth - width) / 2}px`;
    beatSeatStatus.style.top = `${(tableHost.clientHeight - height) / 2}px`;
  }
}

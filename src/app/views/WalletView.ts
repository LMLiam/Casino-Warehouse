import type { GameSnapshot } from '../../game/types';
import type { CasinoProfile } from '../../state/profiles';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements';
import { money } from '../format/appMoney';

export class WalletView {
  private previousBankroll: number | undefined;
  private bankrollDeltaTimer: number | undefined;

  public constructor(private readonly elements: AppElements) {}

  public resetPreviousBankroll(): void {
    this.previousBankroll = undefined;
  }

  public render(snapshot: GameSnapshot, profile: CasinoProfile | undefined, bankrollOverride?: number): void {
    const bankroll = bankrollOverride ?? profile?.bankroll ?? snapshot.bankroll;
    const bankrollDelta = this.previousBankroll === undefined ? 0 : bankroll - this.previousBankroll;
    this.elements.bankroll.textContent = money(bankroll);
    this.animateDelta(bankrollDelta);
    this.previousBankroll = bankroll;
    if (profile) {
      this.elements.profileStats.textContent = `Wagered ${money(profile.stats.totalWagered)} • Won ${money(profile.stats.totalWon)} • Biggest ${money(profile.stats.biggestWin)} • Games ${profile.stats.gamesPlayed}`;
      this.elements.auditLog.innerHTML = profile.transactions
        .slice(0, 8)
        .map((tx) => `<p><b>${escapeHtml(tx.gameId)}</b> ${escapeHtml(tx.description)} ${money(tx.amount)} → ${money(tx.balanceAfter)}</p>`)
        .join('');
    }
  }

  private animateDelta(delta: number): void {
    if (delta === 0) {
      return;
    }

    window.clearTimeout(this.bankrollDeltaTimer);
    this.elements.bankrollDelta.className = '';
    void this.elements.bankrollDelta.offsetWidth;
    this.elements.bankrollDelta.textContent = `${delta > 0 ? '+' : '-'}${money(Math.abs(delta))}`;
    this.elements.bankrollDelta.className = delta > 0 ? 'gain' : 'loss';
    this.elements.bankroll.classList.remove('gain-flash', 'loss-flash');
    void this.elements.bankroll.offsetWidth;
    this.elements.bankroll.classList.add(delta > 0 ? 'gain-flash' : 'loss-flash');

    this.bankrollDeltaTimer = window.setTimeout(() => {
      this.elements.bankrollDelta.textContent = '';
      this.elements.bankrollDelta.className = '';
      this.elements.bankroll.classList.remove('gain-flash', 'loss-flash');
    }, 2200);
  }
}

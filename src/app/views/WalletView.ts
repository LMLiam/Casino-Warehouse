import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { BankrollTransactionMetadata } from '../../state/profiles/BankrollTransactionMetadata';
import type { CasinoProfile } from '../../state/profiles/CasinoProfile';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements/AppElements';
import { money } from '../format/appMoney';

export class WalletView {
  private static readonly auditLogEntryLimit = 8;
  private static readonly bankrollDeltaFlashMs = 2200;

  private previousBankroll: number | undefined;
  private bankrollDeltaTimer: number | undefined;

  public constructor(private readonly elements: AppElements) {}

  public resetPreviousBankroll(): void {
    this.previousBankroll = undefined;
  }

  public clear(): void {
    window.clearTimeout(this.bankrollDeltaTimer);
    this.previousBankroll = undefined;
    this.elements.beatHalfChipIndicator.textContent = '';
    this.elements.beatHalfChipIndicator.classList.add('hidden');
    this.elements.bankrollDelta.textContent = '';
    this.elements.bankrollDelta.className = '';
    this.elements.bankroll.classList.remove('gain-flash', 'loss-flash');
  }

  public render(snapshot: GameSnapshot, profile: CasinoProfile | undefined, bankrollOverride?: number, showBeatHalfChip = false): void {
    const bankroll = bankrollOverride ?? profile?.bankroll ?? snapshot.bankroll;
    const bankrollDelta = this.previousBankroll === undefined ? 0 : bankroll - this.previousBankroll;
    this.elements.bankroll.textContent = money(bankroll);
    this.animateDelta(bankrollDelta);
    this.previousBankroll = bankroll;
    const hasBeatHalfChip = showBeatHalfChip && profile?.gameCredits.beatTheHouseHalfChip === 1;
    this.elements.beatHalfChipIndicator.textContent = hasBeatHalfChip ? 'Half chip: one half' : '';
    this.elements.beatHalfChipIndicator.classList.toggle('hidden', !hasBeatHalfChip);
    if (profile) {
      const houseAdvance =
        profile.houseAdvance.outstandingBalance > 0
          ? ` • House Advance owed ${money(profile.houseAdvance.outstandingBalance)} • Active ${profile.houseAdvance.activeCount}/3`
          : '';
      this.elements.profileStats.textContent = `Wagered ${money(profile.stats.totalWagered)} • Won ${money(profile.stats.totalWon)} • Biggest ${money(profile.stats.biggestWin)} • Games ${profile.stats.gamesPlayed}${houseAdvance}`;
      this.elements.houseAdvancePill.textContent =
        profile.houseAdvance.outstandingBalance > 0
          ? `House Advance owed: ${money(profile.houseAdvance.outstandingBalance)} · ${profile.houseAdvance.activeCount}/3 active`
          : '';
      this.elements.houseAdvancePill.classList.toggle('hidden', profile.houseAdvance.outstandingBalance <= 0);
      this.elements.auditLog.innerHTML = profile.transactions
        .slice(0, WalletView.auditLogEntryLimit)
        .map(
          (tx) =>
            `<p><b>${escapeHtml(tx.gameId)}</b> ${escapeHtml(this.transactionDescription(tx.description, tx.metadata))} ${money(tx.amount)} → ${money(tx.balanceAfter)}</p>`,
        )
        .join('');
    }
  }

  private transactionDescription(description: string, metadata: BankrollTransactionMetadata): string {
    if (typeof metadata.houseAdvanceRepayment === 'number') {
      return `${description} Withheld ${money(metadata.houseAdvanceRepayment)}; owed ${money(Number(metadata.outstandingAfter ?? 0))}.`;
    }
    if (typeof metadata.outstandingBalance === 'number') {
      return `${description} Owed ${money(metadata.outstandingBalance)}.`;
    }
    return description;
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
    }, WalletView.bankrollDeltaFlashMs);
  }
}

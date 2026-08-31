import type { GameSnapshot } from '../types/GameSnapshot';
import { BeatTheHouseSettlement } from './BeatTheHouseSettlement';
import type { GameOptions } from './GameOptions';

export class BeatTheHouseGame extends BeatTheHouseSettlement {
  public constructor(options: GameOptions = {}) {
    super(options);
  }

  public addBankroll(amount: number): GameSnapshot {
    if (amount > 0) {
      this.creditBankroll(amount);
    }

    return this.emit([{ type: 'message', message: `Bankroll is now £${this.bankroll}.` }], `Bankroll is now £${this.bankroll}.`);
  }

  public withdrawBankroll(amount: number): boolean {
    if (amount <= 0 || this.bankroll < amount) {
      return false;
    }

    this.debitBankroll(amount);
    return true;
  }

  public depositBankroll(amount: number): GameSnapshot {
    if (amount > 0) {
      this.creditBankroll(amount);
    }

    return this.snapshot([{ type: 'message', message: `Bankroll is now £${this.bankroll}.` }]);
  }

  public resetBankroll(amount = 100): GameSnapshot {
    this.setBankroll(amount);
    return this.emit([{ type: 'message', message: `Bankroll reset to £${amount}.` }], `Bankroll reset to £${amount}.`);
  }

  public syncBankroll(amount: number): void {
    this.setBankroll(Math.max(0, Math.floor(amount)));
  }
}

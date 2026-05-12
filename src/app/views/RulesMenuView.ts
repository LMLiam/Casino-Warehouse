import type { GameCatalogEntry } from '../../game/catalog/GameCatalogEntry';
import type { AppElements } from '../dom/appElements/AppElements';
import { renderRuleList } from '../format/ruleListHtml';

export class RulesMenuView {
  public constructor(private readonly elements: AppElements) {}

  public render(game: GameCatalogEntry): void {
    const rulesHtml = renderRuleList(game.rules);
    const paytableHtml = renderRuleList(game.paytable);
    this.elements.beatRules.innerHTML = rulesHtml;
    this.elements.beatPaytable.innerHTML = paytableHtml;
    this.elements.blackjackRules.innerHTML = rulesHtml;
    this.elements.blackjackPaytable.innerHTML = paytableHtml;
    this.elements.slotsRules.innerHTML = rulesHtml;
    this.elements.slotsPaytable.innerHTML = paytableHtml;
  }
}

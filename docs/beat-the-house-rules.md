# Beat the House Rules

These are the current rules for the new Beat the House game. They describe
the six-deck shoe and the settlement constants in
`src/game/beatTheHouse/beatTheHouseRules.ts`. The game uses fictional credits;
they have no cash value.

## Shoe And Cards

- Use six standard 52-card decks. The shoe contains 312 cards.
- Shuffle a fresh shoe before play. Select a cut threshold between 219 and 234 cards dealt.
- Mark the shoe for replacement when the cut threshold is reached. Start the next required round with a fresh six-deck shoe.
- Deal without replacement within a round.
- A player may reveal at most four cards.
- The dealer may reveal at most four cards.
- Rank cards as Ace, King, Queen, Jack, 10, 9, 8, 7, 6, 5, 4, 3, 2. Suits matter only when identifying a black Ace.
- A black Ace is the Ace of Spades or Ace of Clubs.

## Main Bet

1. Place the main bet before the first card is revealed.
2. Give each player a first card.
3. If the player's first card is a black Ace, settle an automatic win at 3:2 profit.
4. If the player reveals a 2, settle an immediate loss. A hit that reveals a 2 also loses immediately.
5. If the player has neither an automatic win nor an immediate loss, choose hit or stick until the hand is complete. The fourth card is final automatically.
6. After all player hands are complete, reveal the dealer's first card.
7. If the dealer's first card is a black Ace, settle an automatic dealer win against unresolved player hands.
8. If the dealer reveals a 2, the dealer busts and every unresolved live player hand wins.
9. Otherwise, the dealer hits while the current card value is 9 or below. The dealer sticks on 10 or above. The fourth dealer card is final automatically.
10. If no automatic result applies, compare the player and dealer final ranks. The higher rank wins, equal ranks push, and the lower rank loses.

An ordinary main-bet win pays 1:1 profit. A push returns the main stake. A
loss returns nothing. An automatic black-Ace win pays 3:2 profit.

## Side Bets

Side bets are placed before cards are revealed. Each side bet is settled from
the relevant first cards, final cards, or dealer result. A payout ratio is the
profit paid in addition to the returned stake.

| Side bet      | Winning condition                             | Profit |
| ------------- | --------------------------------------------- | -----: |
| Ace Flash     | Exactly one first card is a black Ace         |   12:1 |
| Ace Flash     | Both first cards are black Aces               |   60:1 |
| Dealer Bust   | The dealer reveals a 2 and busts              |    6:1 |
| Match Push    | The player and dealer finish on the same rank |    9:1 |
| Dealer Sevens | One dealer 7 is revealed                      |    4:1 |
| Dealer Sevens | Two dealer 7s are revealed                    |   18:1 |
| Dealer Sevens | Three dealer 7s are revealed                  |  150:1 |
| Dealer Sevens | Four dealer 7s are revealed                   | 1000:1 |

Dealer Sevens counts every 7 revealed during the dealer turn, including a 7
revealed before a later bust. Pay the highest qualifying tier only. A dealer
first-card black Ace ends the dealer turn without a Dealer Sevens win.

Match Push needs final cards and a live, non-bust dealer result. A player hand
that loses immediately on a 2 has no qualifying final rank.

## Implementation Sources

- `src/game/beatTheHouse/beatTheHouseRules.ts`: shoe, card-limit, dealer-rule, and payout constants.
- `src/game/beatTheHouse/shoe/`: six-deck shoe creation, shuffling, cut threshold, draw, and save-state validation.
- `src/game/beatTheHouse/settlement/settleBeatTheHouseMain.ts`: main-bet result and payout calculation.
- `src/game/beatTheHouse/settlement/settleBeatTheHouseSideBets.ts`: side-bet conditions and payouts.
- `tests/unit/game/beat-the-house-primitives.test.ts`: approved constants and exact half-unit payout contracts.
- `tests/unit/game/beat-the-house-shoe.test.ts`: six-deck shoe and cut-threshold contracts.
- `tests/unit/game/beat-the-house-settlement.test.ts`: main and side settlement contracts.

`docs/Beat_the_House_Official_Casino_Rules_v2_1.docx` is preserved as the
older version 2.1 one-deck reference. It is not the current six-deck rules
source.

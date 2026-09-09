# Beat the House Mathematics

This report describes the approved six-deck Beat the House rules and the
validated production measurement. It is not a rule engine, settlement module,
or statistical policy module.

## Scope And Frozen Rules

- Use six standard decks. The shoe contains 312 cards.
- Select an integer cut threshold uniformly from 219 through 234 cards dealt.
- Finish the active round after the cut threshold. Shuffle before the next deal.
- The dealer hits ranks 3 through 9 and stands on 10, J, Q, K, and A.
- A player first-card black Ace wins at 3:2 profit.
- The black-Ace win has precedence when both first cards are black Aces.
- A player or dealer has a four-card maximum.
- A player revealing a 2 loses immediately. A dealer revealing a 2 busts.
- Ties are pushes.
- Ace Flash pays 12:1 for one qualifying black Ace and 60:1 for two.
- Dealer Bust pays 6:1.
- Match Push pays 9:1.
- Dealer Sevens pays 4:1, 18:1, 150:1, or 1000:1 for one through four
  dealer sevens. Pay the highest qualifying tier only.
- Each side-bet type can equal, but cannot exceed, the main bet on the same
  hand.
- Wagers and Dealer's Thanks use whole chips.
- Settlement uses integer half-units. Each profile can hold one half-chip
  residual. Two half-chips consolidate into one whole chip automatically.
- The residual is not wagerable.
- Shoe composition and ordered cards remain private.

The production rule source is
[`beatTheHouseRules`](../src/game/beatTheHouse/beatTheHouseRules.ts). The
player-visible rules are in [Beat the House rules](beat-the-house-rules.md).

## Source Hierarchy And Provenance

Use these sources in this order:

1. `src/game/beatTheHouse/beatTheHouseRules.ts` for frozen rule numbers.
2. The Plan 14 engine, shoe, summary, and protocol contracts for live behaviour.
3. `scripts/beat-the-house-analysis/canonical-config.json` for the approved
   measurement configuration.
4. `scripts/beat-the-house-analysis/canonical-results.json` for measured values.
5. `tests/unit/game/beat-the-house-rtp.test.ts` for the Plan 18 comparison
   allowance and numerical tolerance.
6. Plan 19 browser tests for visible wording and metadata.

The canonical configuration identity is
`beat-the-house-six-deck-canonical`. It uses ruleset identity
`beat-the-house-six-deck`, seed `171171`, production path, 20 completed shoes,
the cut range 219 through 234, one through three active hands, equal `1/1`
side-to-main ratios, and the `simple` strategy. It contains all 16 side-bet
subsets for each active-hand count, for 48 profiles.

The SHA-256 identities at this review are:

- `canonical-config.json`: `17b687b683898da5c38d1ff53cb46da2000e5eb533ba5f4542e2b878e3fdb10c`
- `canonical-results.json`:
  `95985357e3964876044110a1542dafa9f056ff77e5fbf9927946ee0e5486bc8c`

The deterministic result is separate from the measured runtime. The current
runtime field is `execution.runtimeMs: 758` and is not part of result
comparison.

## Methods And Boundaries

### Exact Fresh-Shoe Oracle

The Plan 04 oracle is an independent finite-state method. It does not call
production deal, action, settlement, room, or store methods.

### Persistent Production Measurement

The Plan 17 production path uses the final engine and one persistent six-deck
shoe for each simulation. A completed shoe is one independent observation.
Rounds within a shoe share card depletion and a cut threshold. They are
therefore correlated and are not independent observations.

The measurement reads exact half-unit fields from settled round summaries. It
uses public shoe metadata for cards dealt and cards remaining. It records only
aggregate evidence.

### Match Push Policy Measurement

The Match Push sweep uses the rational ratios in the canonical configuration.
The action equality rule is `ratio * 2 >= 1`, which selects `stick` on equality.
This policy measurement is separate from the approved `simple` strategy and
from the exact fresh-shoe oracle.

Do not compare exact fresh-shoe, persistent-shoe Monte Carlo, simple strategy,
Match Push strategy, active-hand count, stake profile, or terminal state as if
they were equivalent unless all relevant configuration values match. Expected
value is a long-run model statistic. It is not a guaranteed result or a cash
return.

## Canonical Results

The table reports `returnedPerTotalStake`. Its denominator is
`totalStakeHalfUnits`. Each row uses completed shoes as the observation unit.
Values are rounded to six decimal places. `SD` is sample standard deviation and
`SE` is standard error. `rounds` and `hands` are the settled totals.

| Active hands | Side-bet subset                            | Mean returned | Mean profit |       SD |       SE | Shoes | Rounds | Hands |
| -----------: | ------------------------------------------ | ------------: | ----------: | -------: | -------: | ----: | -----: | ----: |
|            1 | main-only                                  |      1.091035 |    0.091035 | 0.119700 | 0.026766 |    20 |   1039 |  1039 |
|            1 | aceFlash                                   |      1.039325 |    0.039325 | 0.182669 | 0.040846 |    20 |   1051 |  1051 |
|            1 | dealerBust                                 |      0.965366 |   -0.034634 | 0.164428 | 0.036767 |    20 |   1052 |  1052 |
|            1 | aceFlash+dealerBust                        |      1.041287 |    0.041287 | 0.179435 | 0.040123 |    20 |   1055 |  1055 |
|            1 | matchPush                                  |      0.996837 |   -0.003163 | 0.141234 | 0.031581 |    20 |   1053 |  1053 |
|            1 | aceFlash+matchPush                         |      1.032971 |    0.032971 | 0.134077 | 0.029980 |    20 |   1058 |  1058 |
|            1 | dealerBust+matchPush                       |      1.081017 |    0.081017 | 0.178820 | 0.039985 |    20 |   1052 |  1052 |
|            1 | aceFlash+dealerBust+matchPush              |      1.025159 |    0.025159 | 0.138081 | 0.030876 |    20 |   1048 |  1048 |
|            1 | dealerSevens                               |      1.077824 |    0.077824 | 0.400013 | 0.089446 |    20 |   1049 |  1049 |
|            1 | aceFlash+dealerSevens                      |      1.086245 |    0.086245 | 0.441875 | 0.098806 |    20 |   1036 |  1036 |
|            1 | dealerBust+dealerSevens                    |      1.067704 |    0.067704 | 0.200976 | 0.044940 |    20 |   1044 |  1044 |
|            1 | aceFlash+dealerBust+dealerSevens           |      1.056251 |    0.056251 | 0.252682 | 0.056501 |    20 |   1041 |  1041 |
|            1 | matchPush+dealerSevens                     |      1.063086 |    0.063086 | 0.417771 | 0.093416 |    20 |   1045 |  1045 |
|            1 | aceFlash+matchPush+dealerSevens            |      1.174845 |    0.174845 | 0.287717 | 0.064335 |    20 |   1058 |  1058 |
|            1 | dealerBust+matchPush+dealerSevens          |      1.030453 |    0.030453 | 0.286663 | 0.064100 |    20 |   1021 |  1021 |
|            1 | aceFlash+dealerBust+matchPush+dealerSevens |      1.002225 |    0.002225 | 0.161607 | 0.036136 |    20 |   1022 |  1022 |
|            2 | main-only                                  |      0.980494 |   -0.019506 | 0.109066 | 0.024388 |    20 |    674 |  1348 |
|            2 | aceFlash                                   |      1.020481 |    0.020481 | 0.257341 | 0.057543 |    20 |    677 |  1354 |
|            2 | dealerBust                                 |      0.957003 |   -0.042997 | 0.232138 | 0.051908 |    20 |    683 |  1366 |
|            2 | aceFlash+dealerBust                        |      1.041600 |    0.041600 | 0.220443 | 0.049293 |    20 |    684 |  1368 |
|            2 | matchPush                                  |      1.008559 |    0.008559 | 0.156272 | 0.034944 |    20 |    685 |  1370 |
|            2 | aceFlash+matchPush                         |      0.930372 |   -0.069628 | 0.144176 | 0.032239 |    20 |    690 |  1380 |
|            2 | dealerBust+matchPush                       |      1.041876 |    0.041876 | 0.173272 | 0.038745 |    20 |    672 |  1344 |
|            2 | aceFlash+dealerBust+matchPush              |      0.951356 |   -0.048644 | 0.161144 | 0.036033 |    20 |    671 |  1342 |
|            2 | dealerSevens                               |      1.179560 |    0.179560 | 0.643986 | 0.144000 |    20 |    684 |  1368 |
|            2 | aceFlash+dealerSevens                      |      1.180996 |    0.180996 | 0.582269 | 0.130199 |    20 |    684 |  1368 |
|            2 | dealerBust+dealerSevens                    |      1.144105 |    0.144105 | 0.382977 | 0.085636 |    20 |    684 |  1368 |
|            2 | aceFlash+dealerBust+dealerSevens           |      1.041082 |    0.041082 | 0.177163 | 0.039615 |    20 |    675 |  1350 |
|            2 | matchPush+dealerSevens                     |      1.072173 |    0.072173 | 0.399285 | 0.089283 |    20 |    679 |  1358 |
|            2 | aceFlash+matchPush+dealerSevens            |      1.017508 |    0.017508 | 0.181077 | 0.040490 |    20 |    681 |  1362 |
|            2 | dealerBust+matchPush+dealerSevens          |      0.980333 |   -0.019667 | 0.330741 | 0.073956 |    20 |    675 |  1350 |
|            2 | aceFlash+dealerBust+matchPush+dealerSevens |      1.048312 |    0.048312 | 0.148124 | 0.033122 |    20 |    687 |  1374 |
|            3 | main-only                                  |      1.058294 |    0.058294 | 0.163493 | 0.036558 |    20 |    504 |  1512 |
|            3 | aceFlash                                   |      1.025942 |    0.025942 | 0.221619 | 0.049555 |    20 |    507 |  1521 |
|            3 | dealerBust                                 |      1.084864 |    0.084864 | 0.298190 | 0.066677 |    20 |    502 |  1506 |
|            3 | aceFlash+dealerBust                        |      1.047411 |    0.047411 | 0.245808 | 0.054964 |    20 |    512 |  1536 |
|            3 | matchPush                                  |      0.994830 |   -0.005170 | 0.227978 | 0.050977 |    20 |    508 |  1524 |
|            3 | aceFlash+matchPush                         |      0.928291 |   -0.071709 | 0.164425 | 0.036767 |    20 |    512 |  1536 |
|            3 | dealerBust+matchPush                       |      1.025488 |    0.025488 | 0.163265 | 0.036507 |    20 |    511 |  1533 |
|            3 | aceFlash+dealerBust+matchPush              |      1.068956 |    0.068956 | 0.193832 | 0.043342 |    20 |    496 |  1488 |
|            3 | dealerSevens                               |      1.043892 |    0.043892 | 0.327188 | 0.073161 |    20 |    492 |  1476 |
|            3 | aceFlash+dealerSevens                      |      1.161097 |    0.161097 | 0.895694 | 0.200283 |    20 |    511 |  1533 |
|            3 | dealerBust+dealerSevens                    |      0.979325 |   -0.020675 | 0.261535 | 0.058481 |    20 |    508 |  1524 |
|            3 | aceFlash+dealerBust+dealerSevens           |      1.054294 |    0.054294 | 0.407633 | 0.091149 |    20 |    521 |  1563 |
|            3 | matchPush+dealerSevens                     |      0.907867 |   -0.092133 | 0.165021 | 0.036900 |    20 |    510 |  1530 |
|            3 | aceFlash+matchPush+dealerSevens            |      1.000614 |    0.000614 | 0.141413 | 0.031621 |    20 |    504 |  1512 |
|            3 | dealerBust+matchPush+dealerSevens          |      1.147256 |    0.147256 | 0.402967 | 0.090106 |    20 |    511 |  1533 |
|            3 | aceFlash+dealerBust+matchPush+dealerSevens |      1.041475 |    0.041475 | 0.410925 | 0.091886 |    20 |    497 |  1491 |

The same canonical profiles contain `profitPerTotalStake`,
`mainReturnedPerMainStake`, `mainProfitPerMainStake`, seat metrics, and every
configured side-bet metric. Side-bet metrics use observation unit `shoe` and
denominator `sideBetStakeHalfUnits`. Seat metrics use denominator
`seatStakeHalfUnits`. The JSON artefact is the complete value source.

## Standard Error

For a per-shoe normalised value `x` and sample size `n`, use sample standard
deviation with denominator `n - 1` and:

```text
standardError = sampleStandardDeviation / sqrt(n)
```

For two independent samples, Plan 18 uses:

```text
differenceStandardError = sqrt(
  canonicalStandardError^2 + ciStandardError^2
)
tolerance = sigmaAllowance * differenceStandardError
```

The approved sigma allowance is four standard errors. The comparison uses
`max(4 * differenceStandardError, 1e-12)`. The `1e-12` value only permits
binary floating-point normalisation at the comparison boundary. It is not a
confidence interval or confidence guarantee. Deviation and standard error are
unavailable for fewer than two independent shoes.

## Match Push Interaction

The committed rational sweep is:

| Ratio                                      | Action |
| ------------------------------------------ | ------ |
| `0/1`, `1/10`, `1/5`, `3/10`, `2/5`        | hit    |
| `1/2`, `3/5`, `7/10`, `4/5`, `9/10`, `1/1` | stick  |

The measured policy boundary is `ratio >= 1/2` selects `stick`. This is the
ratio-specific Match Push policy result. It is not the production `simple`
strategy and does not replace the fresh-shoe oracle action values.

## Persistent-Shoe Effects

Actual penetration at shuffle uses `cardsDealt / totalCards` after the final
cut-crossing round. The `main-only` profile gives these aggregate values:

| Active hands | Mean penetration |       SD |       SE | Completed rounds per shoe |
| -----------: | ---------------: | -------: | -------: | ------------------------: |
|            1 |         0.725000 | 0.015055 | 0.003366 |                    51.950 |
|            2 |         0.733333 | 0.018089 | 0.004045 |                    33.700 |
|            3 |         0.737179 | 0.022035 | 0.004927 |                    25.200 |

At the start of each round, the analysis places each target in one of three
relative-density bins. It compares remaining target cards with remaining shoe
cards. It reports only aggregate results. The bins are below `0.75`, `0.75`
through `1.25`, and above `1.25`.

For the `main-only` profile, the aggregate returned values by bin are:

| Active hands | Target     | Below 0.75 | 0.75 through 1.25 | Above 1.25 |
| -----------: | ---------- | ---------: | ----------------: | ---------: |
|            1 | black Aces |   1.107330 |          1.074934 |   1.170213 |
|            1 | rank 2s    |   1.161290 |          1.088143 |   0.958333 |
|            1 | rank 7s    |   1.130435 |          1.079733 |   1.284091 |
|            2 | black Aces |   0.816406 |          0.984637 |   1.109589 |
|            2 | rank 2s    |   1.068182 |          0.986905 |   0.863636 |
|            2 | rank 7s    |   0.926923 |          0.986038 |   1.020833 |
|            3 | black Aces |   1.078431 |          1.059875 |   0.977011 |
|            3 | rank 2s    |   1.186275 |          1.046563 |   1.122807 |
|            3 | rank 7s    |   1.019380 |          1.061275 |   1.072327 |

Late-shoe conditional value can differ from the long-run average because cards
are depleted and the cut threshold is pending. These results do not disclose
the target counts, rank counts, suit counts, ordered cards, exact cut
thresholds, hidden dealer cards, random state, or raw shoe records. Every
profile has the same aggregate evidence shape in the canonical JSON.

## Credit And Interpretation Notes

Wagers and normal profile bankroll values use whole chips. Beat the House
returns use half-units and a separate one-half-chip residual. The residual is
not a wager and consolidates automatically when two half-chips are available.

All credits are fictional. They have no cash value. The game has no deposits,
withdrawals, guaranteed returns, or commercial gambling use.

## Reproduction And Verification

Validate the configuration and result with the exact repository schemas and
tests. Rebuild the analysis command before running it:

```bash
npm run test -- tests/unit/game/game-catalog.test.ts tests/unit/game/beat-the-house-analysis.test.ts tests/unit/game/beat-the-house-rtp.test.ts
npm run typecheck
npm run format
npm run build
npm run build:beat-the-house-analysis
```

Do not treat the runtime field as deterministic evidence. Do not regenerate
research-scale results during a documentation-only review.

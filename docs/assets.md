# Asset Catalogue

Runtime asset metadata lives in `src/assets/manifest/casinoAssets.ts`. The
manifest is the source of truth for the files in `public/assets/`. The asset
tests check that every manifested path exists, every public asset is
manifested, dimensions match the PNG header, and no legacy SVG or placeholder
path remains.

## Current Assets

The manifest currently contains 14 production PNG assets.

| ID                          | Path                                          | Owner/category                  | Status/source                              | Dimensions  | Transparent |
| --------------------------- | --------------------------------------------- | ------------------------------- | ------------------------------------------ | ----------- | ----------- |
| `lobby.background`          | `/assets/lobby/warehouse-lobby.png`           | `lobby` / `background`          | `generated-final` / `imagegen`             | `1672x941`  | no          |
| `beat-the-house.table`      | `/assets/beat-the-house/table.png`            | `beat-the-house` / `table`      | `approved-user-provided` / `user-provided` | `1672x941`  | no          |
| `beat-the-house.chips`      | `/assets/common/chips-sheet.png`              | `beat-the-house` / `chip-sheet` | `approved-user-provided` / `user-provided` | `1536x1024` | yes         |
| `blackjack.table`           | `/assets/blackjack/table.png`                 | `blackjack` / `table`           | `generated-final` / `imagegen`             | `1585x992`  | no          |
| `lobby.tile.beat-the-house` | `/assets/lobby/game-tiles/beat-the-house.png` | `lobby` / `game-tile`           | `generated-final` / `imagegen`             | `1672x941`  | no          |
| `lobby.tile.blackjack`      | `/assets/lobby/game-tiles/blackjack.png`      | `lobby` / `game-tile`           | `generated-final` / `imagegen`             | `1672x941`  | no          |
| `lobby.tile.thai-princess`  | `/assets/lobby/game-tiles/thai-princess.png`  | `lobby` / `game-tile`           | `generated-final` / `imagegen`             | `1672x941`  | no          |
| `slots.thai-princess.frame` | `/assets/slots/thai-princess/frame.png`       | `slots` / `slot-frame`          | `generated-final` / `imagegen`             | `1448x1086` | no          |
| `slots.symbol.princess`     | `/assets/slots/symbols/princess.png`          | `slots` / `slot-symbol`         | `generated-final` / `imagegen`             | `512x512`   | yes         |
| `slots.symbol.lotus`        | `/assets/slots/symbols/lotus.png`             | `slots` / `slot-symbol`         | `generated-final` / `imagegen`             | `512x512`   | yes         |
| `slots.symbol.elephant`     | `/assets/slots/symbols/elephant.png`          | `slots` / `slot-symbol`         | `generated-final` / `imagegen`             | `512x512`   | yes         |
| `slots.symbol.temple`       | `/assets/slots/symbols/temple.png`            | `slots` / `slot-symbol`         | `generated-final` / `imagegen`             | `512x512`   | yes         |
| `slots.symbol.fan`          | `/assets/slots/symbols/fan.png`               | `slots` / `slot-symbol`         | `generated-final` / `imagegen`             | `512x512`   | yes         |
| `slots.symbol.orchid`       | `/assets/slots/symbols/orchid.png`            | `slots` / `slot-symbol`         | `generated-final` / `imagegen`             | `512x512`   | yes         |

The two user-provided files have these SHA-256 fingerprints. Use them to
detect an accidental replacement without storing image data in source:

| Path                               | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `/assets/beat-the-house/table.png` | `783ea6fbb963e9dabf6f43831f8f30faf37a92c8d95ea4e5040bdec15c13f1e2` |
| `/assets/common/chips-sheet.png`   | `a89ba4ff5aa402885a79180ebf464fdb3a3920555eea1993b4f24e24a64d8ae7` |

## Access Patterns

- Use `gameTileAsset(gameId)` for lobby tiles.
- Use `slotFrameAsset(themeId)` for a slot frame.
- Use `slotSymbolAsset(symbol)` for a slot symbol.
- Use `blackjackTableAsset()` for the Blackjack table.
- Use `beatTheHouseTableUrl` and `beatTheHouseChipsUrl` for Pixi table resources.
- Use `allCasinoAssets()` for validation and inventory checks.

Do not build asset paths from game names in views. Add metadata to the
manifest and use a focused accessor. `GameLobbyView` and `SlotsView` display
the returned paths. Pixi table code consumes the table accessors.

## Adding An Asset

1. Place the final PNG below `public/assets/` in the directory that owns it.
2. Add a complete `CasinoAsset` entry to `casinoAssets.ts`, including `id`, path, owner, category, status, source, dimensions, and transparency.
3. Add or update a focused accessor when the asset is a new asset category.
4. Import the accessor from the owning renderer or view.
5. Update the asset tests when the new category has a distinct contract.
6. Run `npm run test -- tests/unit/assets/assets-manifest.test.ts` and `npm run architecture:check`.

Only use `generated-final`, `approved-user-provided`, or
`intentional-final-vector` for `status`. Do not add placeholder, temporary,
legacy, deferred, or missing-asset entries. The current catalogue has no SVG
assets and no asset-generation script.

import type { CasinoGameId } from '../game/catalog';
import type { SlotSymbol } from '../game/slots';

export type AssetStatus = 'generated-final' | 'approved-user-provided' | 'intentional-final-vector';
export type AssetSource = 'imagegen' | 'user-provided' | 'final-vector';
export type AssetCategory = 'background' | 'game-tile' | 'table' | 'chip-sheet' | 'slot-frame' | 'slot-symbol';

export interface CasinoAsset {
  readonly id: string;
  readonly path: string;
  readonly owner: string;
  readonly category: AssetCategory;
  readonly status: AssetStatus;
  readonly source: AssetSource;
  readonly dimensions: string;
  readonly transparent: boolean;
}

function asset(
  id: string,
  path: string,
  owner: string,
  category: AssetCategory,
  status: AssetStatus,
  source: AssetSource,
  dimensions: string,
  transparent = false,
): CasinoAsset {
  return {
    id,
    path,
    owner,
    category,
    status,
    source,
    dimensions,
    transparent,
  };
}

export const casinoAssets = {
  lobbyBackground: asset('lobby.background', '/assets/lobby/warehouse-lobby.png', 'lobby', 'background', 'generated-final', 'imagegen', '1672x941'),
  beatTheHouseTable: asset(
    'beat-the-house.table',
    '/assets/beat-the-house/table.png',
    'beat-the-house',
    'table',
    'approved-user-provided',
    'user-provided',
    '1672x941',
  ),
  beatTheHouseChips: asset(
    'beat-the-house.chips',
    '/assets/common/chips-sheet.png',
    'beat-the-house',
    'chip-sheet',
    'approved-user-provided',
    'user-provided',
    '1536x1024',
    true,
  ),
  blackjackTable: asset('blackjack.table', '/assets/blackjack/table.png', 'blackjack', 'table', 'generated-final', 'imagegen', '1585x992'),
  gameTiles: {
    'beat-the-house': asset(
      'lobby.tile.beat-the-house',
      '/assets/lobby/game-tiles/beat-the-house.png',
      'lobby',
      'game-tile',
      'generated-final',
      'imagegen',
      '1672x941',
    ),
    blackjack: asset('lobby.tile.blackjack', '/assets/lobby/game-tiles/blackjack.png', 'lobby', 'game-tile', 'generated-final', 'imagegen', '1672x941'),
    'slots:thai-princess': asset(
      'lobby.tile.thai-princess',
      '/assets/lobby/game-tiles/thai-princess.png',
      'lobby',
      'game-tile',
      'generated-final',
      'imagegen',
      '1672x941',
    ),
  } satisfies Record<CasinoGameId, CasinoAsset>,
  slotFrames: {
    'thai-princess': asset(
      'slots.thai-princess.frame',
      '/assets/slots/thai-princess/frame.png',
      'slots',
      'slot-frame',
      'generated-final',
      'imagegen',
      '1448x1086',
    ),
  },
  slotSymbols: {
    princess: asset('slots.symbol.princess', '/assets/slots/symbols/princess.png', 'slots', 'slot-symbol', 'generated-final', 'imagegen', '512x512', true),
    lotus: asset('slots.symbol.lotus', '/assets/slots/symbols/lotus.png', 'slots', 'slot-symbol', 'generated-final', 'imagegen', '512x512', true),
    elephant: asset('slots.symbol.elephant', '/assets/slots/symbols/elephant.png', 'slots', 'slot-symbol', 'generated-final', 'imagegen', '512x512', true),
    temple: asset('slots.symbol.temple', '/assets/slots/symbols/temple.png', 'slots', 'slot-symbol', 'generated-final', 'imagegen', '512x512', true),
    fan: asset('slots.symbol.fan', '/assets/slots/symbols/fan.png', 'slots', 'slot-symbol', 'generated-final', 'imagegen', '512x512', true),
    orchid: asset('slots.symbol.orchid', '/assets/slots/symbols/orchid.png', 'slots', 'slot-symbol', 'generated-final', 'imagegen', '512x512', true),
  } satisfies Record<SlotSymbol, CasinoAsset>,
} as const;

export const allCasinoAssets = (): readonly CasinoAsset[] => [
  casinoAssets.lobbyBackground,
  casinoAssets.beatTheHouseTable,
  casinoAssets.beatTheHouseChips,
  casinoAssets.blackjackTable,
  ...Object.values(casinoAssets.gameTiles),
  ...Object.values(casinoAssets.slotFrames),
  ...Object.values(casinoAssets.slotSymbols),
];

export const gameTileAsset = (gameId: CasinoGameId): CasinoAsset => casinoAssets.gameTiles[gameId as keyof typeof casinoAssets.gameTiles];

export const blackjackTableAsset = (): CasinoAsset => casinoAssets.blackjackTable;

export const slotFrameAsset = (themeId: string): CasinoAsset => casinoAssets.slotFrames[themeId as keyof typeof casinoAssets.slotFrames];

export const slotSymbolAsset = (symbol: SlotSymbol): CasinoAsset => casinoAssets.slotSymbols[symbol];

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { allCasinoAssets } from '../../../src/assets/manifest/allCasinoAssets';
import { casinoAssets } from '../../../src/assets/manifest/casinoAssets';
import { gameTileAsset } from '../../../src/assets/manifest/gameTileAsset';
import { slotFrameAsset } from '../../../src/assets/manifest/slotFrameAsset';
import { slotSymbolAsset } from '../../../src/assets/manifest/slotSymbolAsset';
import { gameCatalog } from '../../../src/game/catalog/gameCatalog';
import type { SlotSymbol } from '../../../src/game/slots/SlotSymbol';

const workspaceRoot = process.cwd();
const allowedStatuses = new Set(['generated-final', 'approved-user-provided', 'intentional-final-vector']);
const forbiddenAssetLanguage =
  /generated-placeholder|manual placeholder|legacy placeholder|temporary fallback|optional-deferred|deferred required|missing required asset/i;
const forbiddenLegacyPath =
  /(?:\.\.\/\.\.\/(?:table|chips-sheet)\.png|['"`]\/(?:table|chips-sheet)\.png['"`]|\/assets\/blackjack\/table\.svg|\/assets\/lobby\/game-tiles\/[^'"`)]+\.svg|\/assets\/slots\/[^'"`)]+\/frame\.svg)/;

const assetFilePath = (assetPath: string): string => {
  const relativePath = assetPath.replace(/^\//, '');
  const publicPath = join(workspaceRoot, 'public', relativePath);
  return existsSync(publicPath) ? publicPath : join(workspaceRoot, relativePath);
};

const assetPathExists = (assetPath: string): boolean => existsSync(assetFilePath(assetPath));

const pngDimensions = (assetPath: string): string => {
  const buffer = readFileSync(assetFilePath(assetPath));
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
};

const pngAlphaSummary = (
  assetPath: string,
): { readonly alphaMin: number; readonly alphaMax: number; readonly opaqueChromaPixels: number; readonly transparentCorners: number } => {
  const buffer = readFileSync(assetFilePath(assetPath));
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  expect(bitDepth).toBe(8);
  expect(colorType).toBe(6);

  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') {
      chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    }
    if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  const bytes = inflateSync(Buffer.concat(chunks));
  const channels = 4;
  const stride = width * channels;
  let byteIndex = 0;
  let previousRow = Buffer.alloc(stride);
  let alphaMin = 255;
  let alphaMax = 0;
  let opaqueChromaPixels = 0;
  let transparentCorners = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = bytes[byteIndex];
    byteIndex += 1;
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previousRow[x];
      const upperLeft = x >= channels ? previousRow[x - channels] : 0;
      row[x] = reconstructPngByte(filter, bytes[byteIndex], left, up, upperLeft);
      byteIndex += 1;
    }

    for (let x = 0; x < width; x += 1) {
      const pixel = x * channels;
      const red = row[pixel];
      const green = row[pixel + 1];
      const blue = row[pixel + 2];
      const alpha = row[pixel + 3];
      alphaMin = Math.min(alphaMin, alpha);
      alphaMax = Math.max(alphaMax, alpha);
      if (green > 220 && red < 40 && blue < 80 && alpha > 200) {
        opaqueChromaPixels += 1;
      }
      if ((x === 0 || x === width - 1) && (y === 0 || y === height - 1) && alpha === 0) {
        transparentCorners += 1;
      }
    }
    previousRow = row;
  }

  return { alphaMin, alphaMax, opaqueChromaPixels, transparentCorners };
};

const reconstructPngByte = (filter: number, raw: number, left: number, up: number, upperLeft: number): number => {
  if (filter === 0) {
    return raw;
  }
  if (filter === 1) {
    return (raw + left) & 255;
  }
  if (filter === 2) {
    return (raw + up) & 255;
  }
  if (filter === 3) {
    return (raw + Math.floor((left + up) / 2)) & 255;
  }
  const predictor = left + up - upperLeft;
  const leftDelta = Math.abs(predictor - left);
  const upDelta = Math.abs(predictor - up);
  const upperLeftDelta = Math.abs(predictor - upperLeft);
  const paeth = leftDelta <= upDelta && leftDelta <= upperLeftDelta ? left : upDelta <= upperLeftDelta ? up : upperLeft;
  return (raw + paeth) & 255;
};

const listFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(path);
    }
    return path;
  });

const readTextFiles = (paths: readonly string[]): string =>
  paths
    .filter((path) => existsSync(path) && statSync(path).isFile())
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');

const sourceFiles = listFiles(join(workspaceRoot, 'src')).filter((path) => /\.(ts|css)$/.test(path));
const docsAndReadme = [join(workspaceRoot, 'README.md'), join(workspaceRoot, 'docs', 'assets-needed.md'), join(workspaceRoot, 'docs', 'completion-audit.md')];

const assetFiles = listFiles(join(workspaceRoot, 'public', 'assets'));

const usedAssetPaths = (): readonly string[] => {
  const sourceText = readTextFiles(sourceFiles);
  return allCasinoAssets()
    .map((asset) => asset.path)
    .filter((assetPath) => sourceText.includes(assetPath));
};

describe('casino asset manifest', () => {
  it('lists only production assets with concrete files and accurate metadata', () => {
    const assets = allCasinoAssets();
    expect(assets.length).toBe(14);
    expect(assets.every((asset) => asset.id && asset.owner && asset.path && asset.category && asset.status && asset.source && asset.dimensions)).toBe(true);
    expect(assets.every((asset) => allowedStatuses.has(asset.status))).toBe(true);
    expect(assets.every((asset) => asset.path.startsWith('/assets/'))).toBe(true);
    expect(assets.map((asset) => [asset.id, assetPathExists(asset.path), pngDimensions(asset.path)])).toEqual(
      assets.map((asset) => [asset.id, true, asset.dimensions]),
    );
    expect(assets.filter((asset) => asset.status === 'generated-final').every((asset) => asset.source === 'imagegen')).toBe(true);
    expect(
      assets
        .filter((asset) => asset.status === 'approved-user-provided')
        .map((asset) => asset.path)
        .sort(),
    ).toEqual(['/assets/beat-the-house/table.png', '/assets/common/chips-sheet.png']);
  });

  it('provides distinct lobby tile and slot frame art for every catalog game', () => {
    for (const game of gameCatalog) {
      expect(gameTileAsset(game.id).path).toContain('/assets/lobby/game-tiles/');
      expect(assetPathExists(gameTileAsset(game.id).path)).toBe(true);
      if (game.slotTheme) {
        expect(assetPathExists(slotFrameAsset(game.slotTheme.id).path)).toBe(true);
      }
    }

    expect(new Set(Object.values(casinoAssets.gameTiles).map((asset) => asset.path)).size).toBe(gameCatalog.length);
    expect(new Set(Object.values(casinoAssets.slotFrames).map((asset) => asset.path)).size).toBe(1);
    expect(new Set(Object.values(casinoAssets.slotFrames).map((asset) => pngDimensions(asset.path))).size).toBe(1);
    expect(new Set(Object.values(casinoAssets.slotSymbols).map((asset) => asset.path)).size).toBe(6);
    expect(new Set(Object.values(casinoAssets.slotSymbols).map((asset) => pngDimensions(asset.path))).size).toBe(1);
  });

  it('provides transparent generated image assets for every slot reel symbol', () => {
    const symbols: readonly SlotSymbol[] = ['princess', 'lotus', 'elephant', 'temple', 'fan', 'orchid'];
    for (const symbol of symbols) {
      const asset = slotSymbolAsset(symbol);
      expect(asset).toMatchObject({ category: 'slot-symbol', source: 'imagegen', transparent: true, dimensions: '512x512' });
      expect(pngAlphaSummary(asset.path)).toEqual({ alphaMin: 0, alphaMax: 255, opaqueChromaPixels: 0, transparentCorners: 4 });
    }
  });

  it('keeps stale placeholders, legacy paths, and duplicate asset routes out of code and docs', () => {
    expect(readFileSync(join(workspaceRoot, 'src', 'assets', 'manifest', 'casinoAssets.ts'), 'utf8')).not.toMatch(forbiddenAssetLanguage);
    expect(readTextFiles(docsAndReadme)).not.toMatch(forbiddenAssetLanguage);
    expect(readTextFiles([...sourceFiles, ...docsAndReadme])).not.toMatch(forbiddenLegacyPath);
    expect(existsSync(join(workspaceRoot, 'scripts', 'generate-assets.mjs'))).toBe(false);
    expect(existsSync(join(workspaceRoot, 'table.png'))).toBe(false);
    expect(existsSync(join(workspaceRoot, 'chips-sheet.png'))).toBe(false);
    expect(assetFiles.filter((path) => path.endsWith('.svg'))).toEqual([]);
  });

  it('uses every manifest asset from the app source and keeps all public assets manifested', () => {
    const manifestPaths = allCasinoAssets().map((asset) => asset.path);
    expect([...usedAssetPaths()].sort()).toEqual([...manifestPaths].sort());
    expect(assetFiles.map((file) => file.replace(join(workspaceRoot, 'public'), '')).sort()).toEqual(manifestPaths.sort());
  });
});

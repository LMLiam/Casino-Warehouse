import { Container, Texture } from 'pixi.js';
import type { ChipValue } from '../chips/ChipValue';
import { CardRenderer } from '../renderers/CardRenderer';
import { ChipRenderer } from '../renderers/ChipRenderer';
import { EffectRenderer } from '../renderers/EffectRenderer';
import { TagRenderer } from '../renderers/TagRenderer';

export interface PixiTableDependencies {
  readonly createCardRenderer: (layer: Container) => CardRenderer;
  readonly createChipRenderer: (layer: Container, chipTextures: ReadonlyMap<ChipValue, Texture>) => ChipRenderer;
  readonly createEffectRenderer: (layer: Container) => EffectRenderer;
  readonly createTagRenderer: (layer: Container) => TagRenderer;
}

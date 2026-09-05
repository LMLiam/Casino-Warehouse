import { Application, Container, Texture } from 'pixi.js';
import { CardRenderer } from '../renderers/CardRenderer';
import { EffectRenderer } from '../renderers/EffectRenderer';
import { TagRenderer } from '../renderers/TagRenderer';
import type { ChipValue } from '../chips/ChipValue';
import type { PixiTableDependencies } from './PixiTableDependencies';
import type { PixiTableOptions } from './PixiTableOptions';
import type { PixiTableSettlementMetadata } from './PixiTableSettlementMetadata';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { ChipRenderer } from '../renderers/ChipRenderer';

export abstract class PixiTableBase {
  protected readonly app = new Application();
  protected readonly root = new Container();
  protected readonly dynamicLayer = new Container();
  protected readonly zoneLayer = new Container();
  protected readonly effectLayer = new Container();
  protected readonly cardLayer = new Container();
  protected readonly cardRenderer: CardRenderer;
  protected readonly tagRenderer: TagRenderer;
  protected readonly effectRenderer: EffectRenderer;
  protected chipRenderer?: ChipRenderer;
  protected selectedChip = 0;
  protected snapshot?: GameSnapshot;
  protected cardAnimationQueue = new Map<string, number>();
  protected processedRoundStartKey = '';
  protected settlementKey = '';
  protected announcedSettlementKey = '';
  protected celebratedSettlementKey = '';
  protected settlementMetadata: readonly PixiTableSettlementMetadata[] = [];
  protected settlementVisible = false;
  protected settlementTimer?: number;
  protected initialized = false;

  public constructor(
    protected readonly host: HTMLElement,
    protected readonly options: PixiTableOptions,
    protected readonly dependencies: PixiTableDependencies,
  ) {
    this.cardRenderer = dependencies.createCardRenderer(this.cardLayer);
    this.tagRenderer = dependencies.createTagRenderer(this.dynamicLayer);
    this.effectRenderer = dependencies.createEffectRenderer(this.effectLayer);
  }

  protected createChipRenderer(textures: ReadonlyMap<ChipValue, Texture>): void {
    this.chipRenderer = this.dependencies.createChipRenderer(this.dynamicLayer, textures);
  }
}

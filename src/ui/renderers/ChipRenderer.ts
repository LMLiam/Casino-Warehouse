import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { toChipBreakdown, type ChipValue } from '../chips';
import { CHIP_RENDERING, COLORS, TAG_RENDERING } from './renderingConstants';

interface ChipStackAnimation {
  readonly key: string;
  readonly from?: { readonly x: number; readonly y: number };
  readonly to?: { readonly x: number; readonly y: number };
}

export class ChipRenderer {
  private readonly animatedStacks = new Set<string>();

  public constructor(
    private readonly layer: Container,
    private readonly chipTextures: ReadonlyMap<ChipValue, Texture>,
  ) {}

  public clearAnimations(): void {
    this.animatedStacks.clear();
  }

  public drawStack(amount: number, x: number, y: number, radius = 22, animation?: string | ChipStackAnimation): void {
    const { roundedAmount, chips } = toChipBreakdown(amount);
    const visibleChips = chips.slice(0, CHIP_RENDERING.maxVisibleStackChips);
    const stack = new Container();
    const movement = typeof animation === 'string' ? undefined : animation;
    const animationKey = typeof animation === 'string' ? animation : animation?.key;
    const target = movement?.to ?? { x, y };
    const origin = movement?.from ?? { x, y };
    stack.position.set(target.x, target.y);
    this.layer.addChild(stack);

    visibleChips.forEach((chip, index) => {
      this.drawChip(chip, index * radius * CHIP_RENDERING.stackXStep - radius * CHIP_RENDERING.stackXStep, -index * radius * CHIP_RENDERING.stackYStep, radius, stack);
    });

    if (chips.length > visibleChips.length) {
      this.drawAmountTag(`£${roundedAmount.toLocaleString('en-GB')}`, radius * CHIP_RENDERING.amountTagXOffset, radius * CHIP_RENDERING.amountTagYOffset, stack);
    }

    if (!animationKey || this.animatedStacks.has(animationKey) || prefersReducedMotion()) {
      return;
    }

    this.animatedStacks.add(animationKey);
    if (movement) {
      stack.position.set(origin.x, origin.y);
      gsap.to(stack, {
        x: target.x,
        y: target.y,
        duration: CHIP_RENDERING.slideDuration,
        ease: 'power2.out',
      });
      return;
    }

    stack.scale.set(0.72);
    gsap.fromTo(stack, { alpha: 0, y: y - 22 }, { alpha: 1, y, duration: 0.3, ease: 'back.out(1.5)' });
    gsap.to(stack.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.5)' });
  }

  private drawChip(value: ChipValue, x: number, y: number, radius: number, layer: Container): void {
    const texture = this.chipTextures.get(value);
    if (!texture) {
      return;
    }

    const chip = new Sprite(texture);
    chip.anchor.set(0.5);
    chip.position.set(x, y);
    chip.width = radius * CHIP_RENDERING.spriteScale;
    chip.height = radius * CHIP_RENDERING.spriteScale;
    layer.addChild(chip);
  }

  private drawAmountTag(text: string, x: number, y: number, layer: Container): void {
    const width = Math.max(64, text.length * 8);
    const group = new Container();
    group.position.set(x, y);
    const backing = new Graphics()
      .roundRect(-width / 2, -TAG_RENDERING.height / 2, width, TAG_RENDERING.height, TAG_RENDERING.radius)
      .fill({ color: COLORS.black, alpha: 0.78 })
      .stroke({ color: COLORS.gold, width: 2, alpha: 0.88 });
    const label = new Text({
      text,
      style: new TextStyle({ fill: 0xfff2bc, fontFamily: 'Arial', fontSize: TAG_RENDERING.fontSize, fontWeight: 'bold' }),
    });
    label.anchor.set(0.5);
    group.addChild(backing, label);
    layer.addChild(group);
  }
}

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

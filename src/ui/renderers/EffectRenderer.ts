import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import type { GameEvent } from '../../game/types/GameEvent';
import { tableSize } from '../layout/tableSize';
import { COLORS } from './renderingConstants/COLORS';
import { SIDE_WIN_EFFECT } from './renderingConstants/SIDE_WIN_EFFECT';

export class EffectRenderer {
  private static readonly sparkleDelayStep = 0.035;
  private static readonly confettiPieceCount = 80;
  private static readonly confettiSpawnY = -20;
  private static readonly confettiSpawnYRange = 180;
  private static readonly confettiFallPadding = 30;
  private static readonly confettiDriftCenter = 0.5;
  private static readonly confettiDriftRange = 220;
  private static readonly confettiMaxRotation = 8;
  private static readonly confettiDurationBase = 1.7;
  private static readonly confettiDurationRange = 0.8;

  public constructor(private readonly layer: Container) {}

  public drawSideBetWin(x: number, y: number, width: number, height: number, isWagered: boolean): void {
    const effectAlpha = isWagered ? SIDE_WIN_EFFECT.wageredAlpha : SIDE_WIN_EFFECT.unwageredAlpha;
    const shine = new Container();
    shine.position.set(x, y);
    shine.alpha = effectAlpha;

    const halo = new Graphics()
      .ellipse(0, 0, width * SIDE_WIN_EFFECT.haloScaleX, height * SIDE_WIN_EFFECT.haloScaleY)
      .fill({ color: COLORS.gold, alpha: 0.13 });
    const ring = new Graphics()
      .ellipse(0, 0, width * SIDE_WIN_EFFECT.ringScaleX, height * SIDE_WIN_EFFECT.ringScaleY)
      .stroke({ color: COLORS.goldSoft, width: 6, alpha: 0.92 });
    const innerRing = new Graphics()
      .ellipse(0, 0, width * SIDE_WIN_EFFECT.innerScaleX, height * SIDE_WIN_EFFECT.innerScaleY)
      .stroke({ color: COLORS.white, width: 2, alpha: 0.55 });

    shine.addChild(halo, ring, innerRing);
    this.layer.addChild(shine);

    if (EffectRenderer.prefersReducedMotion()) {
      return;
    }

    gsap.fromTo(halo, { alpha: 0.25, scale: 0.84 }, { alpha: 1, scale: 1.12, repeat: 4, yoyo: true, duration: 0.46, ease: 'sine.inOut' });
    gsap.fromTo(ring, { alpha: 0.65, scale: 0.92 }, { alpha: 1, scale: 1.08, repeat: 4, yoyo: true, duration: 0.46, ease: 'sine.inOut' });
    gsap.fromTo(innerRing, { rotation: 0, alpha: 0.25 }, { rotation: Math.PI * 2, alpha: 0.85, duration: 1.4, ease: 'power1.inOut' });

    for (let index = 0; index < SIDE_WIN_EFFECT.sparkleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / SIDE_WIN_EFFECT.sparkleCount;
      const sparkle = new Graphics().star(0, 0, 4, 6, 2).fill({ color: index % 2 === 0 ? COLORS.white : COLORS.gold, alpha: 0.9 });
      sparkle.position.set(Math.cos(angle) * width * SIDE_WIN_EFFECT.innerScaleX, Math.sin(angle) * height * SIDE_WIN_EFFECT.innerScaleY);
      shine.addChild(sparkle);
      gsap.fromTo(
        sparkle,
        { alpha: 0.15, scale: 0.4 },
        { alpha: 1, scale: 1.15, repeat: 3, yoyo: true, duration: 0.34, delay: index * EffectRenderer.sparkleDelayStep, ease: 'sine.inOut' },
      );
    }
  }

  public drawConfetti(events: readonly GameEvent[]): void {
    if (!events.some((event) => event.type === 'round-settled' && (event.totalProfit ?? 0) > 0)) {
      return;
    }

    if (EffectRenderer.prefersReducedMotion()) {
      const banner = new Graphics().roundRect(tableSize.width / 2 - 240, 58, 480, 24, 12).fill({ color: COLORS.gold, alpha: 0.22 });
      this.layer.addChild(banner);
      return;
    }

    for (let index = 0; index < EffectRenderer.confettiPieceCount; index += 1) {
      const palette = [COLORS.gold, 0xfff5d6, 0xd23b32, 0x2d72ff] as const;
      const paletteColor = palette[index % palette.length];
      if (paletteColor === undefined) {
        continue;
      }
      const bit = new Graphics().rect(-4, -3, 8, 6).fill({ color: paletteColor });
      bit.position.set(Math.random() * tableSize.width, EffectRenderer.confettiSpawnY - Math.random() * EffectRenderer.confettiSpawnYRange);
      this.layer.addChild(bit);
      gsap.to(bit, {
        y: tableSize.height + EffectRenderer.confettiFallPadding,
        x: bit.x + (Math.random() - EffectRenderer.confettiDriftCenter) * EffectRenderer.confettiDriftRange,
        rotation: Math.random() * EffectRenderer.confettiMaxRotation,
        duration: EffectRenderer.confettiDurationBase + Math.random() * EffectRenderer.confettiDurationRange,
        ease: 'power2.in',
        onComplete: () => bit.destroy(),
      });
    }
  }

  private static prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

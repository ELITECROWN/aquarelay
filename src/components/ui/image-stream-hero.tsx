"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the corridor ────────────────────────────────────────────────
 * Two rails of cards ride from far behind the screen toward the
 * viewer. Perspective alone does the work that looks like two
 * animations: as a card's z grows it gets bigger *and* its screen x
 * sweeps outward from the vanishing point, because the projection
 * scales position and size by the same factor.
 *
 * Three things shape it, and each one fixes a specific artefact:
 *
 * 1. Depth is authored as *apparent size*, geometrically — each card
 *    is a constant ratio bigger than the one behind it, all the way
 *    out. Spacing a straight z-range evenly instead makes the near
 *    cards tear apart from each other as the projection blows up.
 * 2. The rails open hard in the first stretch and then hold
 *    (`fan` > 1). That opening cancels the — still slow — growth back
 *    there, so the ribbon leaves the centre as a flat band, bends
 *    once, and only then runs out on the diagonal. Parallel rails
 *    project to a straight cone with no bend at all.
 * 3. Neither end of the loop is ever on screen. A card dies with its
 *    inner edge past 50cqw, clear of the container's edge. And it is
 *    born *across* the axis — `railBirth` is negative, so the newest
 *    card starts on the far side and sweeps back through the centre.
 *    That plugs the throat: the axis stays covered at every instant,
 *    and a newborn lands behind cards that already cover it, so it
 *    needs no fade in. Birthing on its own side instead leaves a hole
 *    at dead centre that blinks open once every cycle.
 *
 * Every length is in `cqw` — a percentage of the container's width —
 * so the whole corridor keeps its proportions at any size. The
 * defaults were fitted numerically against a reference recording's
 * card-height and edge-position profile, not eyeballed.
 * ─────────────────────────────────────────────────────────────── */

export type CorridorPath = {
  /** Strength of the projection. Lower is a wider-angle, more dramatic rush. @default 30 */
  perspective?: number;
  /** Card width in world units. @default 18 */
  cardWidth?: number;
  /** Card height in world units. @default 25 */
  cardHeight?: number;
  /** Corner radius applied to each card. @default 0.4 */
  cardRadius?: number;
  /** On-screen card height at the waist, where a card is born. @default 2.6 */
  birthHeight?: number;
  /** On-screen card height as a card leaves the frame. @default 46 */
  exitHeight?: number;
  /**
   * Lateral offset at birth. Negative starts the card across the axis so the
   * centre never opens up — see note 3 above. @default -11
   */
  railBirth?: number;
  /** Lateral offset once the rails have finished opening. @default 44 */
  railExit?: number;
  /** How front-loaded the opening is. >1 opens early then holds. @default 3.3 */
  fan?: number;
  /** Y-rotation at birth, degrees. @default 6 */
  turnBirth?: number;
  /** Y-rotation at exit, degrees. @default 28 */
  turnExit?: number;
  /** Keyframe stops used to trace the curve. Raise only if motion looks faceted. @default 24 */
  stops?: number;
};

const PATH: Required<CorridorPath> = {
  perspective: 30,
  cardWidth: 18,
  cardHeight: 25,
  cardRadius: 0.4,
  birthHeight: 2.6,
  exitHeight: 46,
  railBirth: -11,
  railExit: 44,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 24,
};

/** Mathematical transform calculation for a card at parametric position u */
export function computeCardState(
  u: number,
  dir: 1 | -1,
  p: Required<CorridorPath>,
) {
  const normU = ((u % 1) + 1) % 1;
  const scale =
    (p.birthHeight / p.cardHeight) *
    Math.pow(p.exitHeight / p.birthHeight, normU);
  const z = p.perspective * (1 - 1 / scale);
  const rail =
    p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - normU, p.fan);
  const turn = p.turnBirth + (p.turnExit - p.turnBirth) * normU;
  return {
    transform: `translate3d(${(dir * rail).toFixed(2)}cqw, 0, ${z.toFixed(2)}cqw) rotateY(${(-dir * turn).toFixed(2)}deg)`,
    normU,
  };
}

/** Sample the path once so the CSS keyframes trace the real curve. */
function keyframes(dir: 1 | -1, name: string, p: Required<CorridorPath>) {
  const steps: string[] = [];
  for (let s = 0; s <= p.stops; s++) {
    const u = s / p.stops;
    const scale =
      (p.birthHeight / p.cardHeight) *
      Math.pow(p.exitHeight / p.birthHeight, u);
    const z = p.perspective * (1 - 1 / scale);
    const rail =
      p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - u, p.fan);
    const turn = p.turnBirth + (p.turnExit - p.turnBirth) * u;
    steps.push(
      `${(u * 100).toFixed(2)}%{transform:translate3d(${(dir * rail).toFixed(
        2,
      )}cqw,0,${z.toFixed(2)}cqw) rotateY(${(-dir * turn).toFixed(2)}deg)}`,
    );
  }
  return `@keyframes ${name}{${steps.join("")}}`;
}

export type StreamImage = {
  src: string;
  /** Only used if you drop the decorative treatment; the corridor is aria-hidden. */
  alt?: string;
};

export type ImageStreamHeroProps = {
  /**
   * Images cycled onto the rails. Both rails run the same sequence, so the
   * corridor reads as one mirrored stream. Fewer than `cards` simply repeat.
   */
  images: StreamImage[];
  /**
   * Cards on each rail at once. More cards means a denser corridor, not a
   * faster one — spacing is derived from this and `speed`.
   * @default 9
   */
  cards?: number;
  /**
   * Seconds for one card to travel the whole corridor when in auto-play mode.
   * @default 18
   */
  speed?: number;
  /**
   * Vertical placement of the corridor's axis, as a percentage of height.
   * @default 55
   */
  axis?: number;
  /** Override any part of the corridor geometry. Merged over the defaults. */
  path?: CorridorPath;
  /** Content rendered above the corridor. */
  children?: React.ReactNode;
  className?: string;
  /**
   * When true, motion is controlled strictly by user scrolling & scrubbing
   * instead of continuous auto-looping playback.
   */
  scrollDriven?: boolean;
  /**
   * Optional externally driven scroll progress (0..N).
   */
  scrollProgress?: number;
};

export function ImageStreamHero({
  images,
  cards = 9,
  speed = 18,
  axis = 55,
  path,
  children,
  className,
  scrollDriven = false,
  scrollProgress,
  ...props
}: React.ComponentProps<"div"> & ImageStreamHeroProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const right = `ish-r-${id}`;
  const left = `ish-l-${id}`;
  const card = `ish-c-${id}`;

  const p = React.useMemo(() => ({ ...PATH, ...path }), [path]);

  // Scroll tracking state
  const [pageScroll, setPageScroll] = React.useState(0);
  const [wheelOffset, setWheelOffset] = React.useState(0);
  const [dragOffset, setDragOffset] = React.useState(0);
  const isDraggingRef = React.useRef(false);
  const lastPointerPos = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!scrollDriven || scrollProgress !== undefined) return;

    const onScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const winH = window.innerHeight;
      const startY = winH * 0.9;
      const endY = -rect.height * 0.4;
      const total = startY - endY;
      const current = startY - rect.top;
      const progress = Math.max(0, current / total);
      setPageScroll(progress * 2.8);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollDriven, scrollProgress]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollDriven) return;
    setWheelOffset((prev) => prev + e.deltaY * 0.001);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!scrollDriven) return;
    isDraggingRef.current = true;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!scrollDriven || !isDraggingRef.current || !lastPointerPos.current) return;
    const dx = e.clientX - lastPointerPos.current.x;
    const dy = e.clientY - lastPointerPos.current.y;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    const delta = dx * -0.0025 + dy * 0.002;
    setDragOffset((prev) => prev + delta);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!scrollDriven) return;
    isDraggingRef.current = false;
    lastPointerPos.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const effectiveProgress =
    (scrollProgress ?? pageScroll) + wheelOffset + dragOffset;

  const css = React.useMemo(() => {
    if (scrollDriven) return "";
    return (
      `${keyframes(1, right, p)}${keyframes(-1, left, p)}` +
      `@media(prefers-reduced-motion:reduce){.${card}{animation-play-state:paused}}`
    );
  }, [right, left, card, p, scrollDriven]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      {...props}
      style={{
        containerType: "inline-size",
        touchAction: scrollDriven ? "pan-y" : undefined,
        ...props.style,
      }}
    >
      {css ? <style>{css}</style> : null}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          perspective: `${p.perspective}cqw`,
          perspectiveOrigin: `50% ${axis}%`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
        >
          {[right, left].map((name, railIndex) => {
            const dir: 1 | -1 = railIndex === 0 ? 1 : -1;
            return Array.from({ length: cards }, (_, i) => {
              if (scrollDriven) {
                const rawU = i / cards + effectiveProgress;
                const { transform, normU } = computeCardState(rawU, dir, p);
                const cycle = Math.floor(rawU);
                const imgIndex =
                  ((i + cycle) % Math.max(images.length, 1) +
                    Math.max(images.length, 1)) %
                  Math.max(images.length, 1);
                const img = images[imgIndex];

                return (
                  <div
                    key={`${name}-${i}`}
                    className={cn(
                      card,
                      "absolute overflow-hidden select-none",
                    )}
                    style={{
                      left: "50%",
                      top: `${axis}%`,
                      width: `${p.cardWidth}cqw`,
                      height: `${p.cardHeight}cqw`,
                      marginLeft: `${-p.cardWidth / 2}cqw`,
                      marginTop: `${-p.cardHeight / 2}cqw`,
                      borderRadius: `${p.cardRadius}cqw`,
                      transform,
                      zIndex: Math.round(normU * 100),
                      backfaceVisibility: "hidden",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      boxShadow: "0 10px 32px rgba(0, 0, 0, 0.16)",
                    }}
                  >
                    {img ? (
                      <img
                        src={img.src}
                        alt={img.alt ?? ""}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover pointer-events-none"
                        draggable={false}
                      />
                    ) : null}
                  </div>
                );
              }

              // Continuous keyframe fallback mode
              const img = images[i % Math.max(images.length, 1)];
              return (
                <div
                  key={`${name}-${i}`}
                  className={cn(
                    card,
                    "absolute overflow-hidden select-none",
                  )}
                  style={{
                    left: "50%",
                    top: `${axis}%`,
                    width: `${p.cardWidth}cqw`,
                    height: `${p.cardHeight}cqw`,
                    marginLeft: `${-p.cardWidth / 2}cqw`,
                    marginTop: `${-p.cardHeight / 2}cqw`,
                    borderRadius: `${p.cardRadius}cqw`,
                    animation: `${name} ${speed}s linear infinite`,
                    animationDelay: `${-(i * speed) / cards}s`,
                    backfaceVisibility: "hidden",
                    border: "1px solid rgba(255, 255, 255, 0.45)",
                    boxShadow: "0 10px 32px rgba(0, 0, 0, 0.16)",
                  }}
                >
                  {img ? (
                    <img
                      src={img.src}
                      alt={img.alt ?? ""}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover pointer-events-none"
                      draggable={false}
                    />
                  ) : null}
                </div>
              );
            });
          })}
        </div>
      </div>

      {children}
    </div>
  );
}

export default ImageStreamHero;

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The tail as one continuous stroke: a straight run that drops, swings back
 * and ends in a bean (Brand Book, Shapes → The tail). Shared by TailUnderline
 * and TailRule.
 *
 * It is ONE SVG path, drawn to the measured width of its parent. It used to
 * be a CSS bar plus an SVG curl, and those can't be made to meet: they were
 * sized by separate numbers (the bar stopped short of the curl and sat off
 * its line), and even with the numbers unified the browser snaps a box's
 * edges to whole device pixels while a stroke keeps its exact width, which
 * left a sub-pixel step at the join. One path has no join.
 *
 * Fills its positioned parent's width. `width` is the curl's footprint and
 * `thickness` the line, both in `unit`: `em` follows the text it underlines,
 * `px` stays put.
 */
const VB_W = 60;
const VB_H = 44;

export default function TailStroke({
  width,
  thickness,
  unit,
  beanRadius,
  bean,
  className = '',
}: {
  /** The curl's footprint at the right-hand end. */
  width: number;
  /** Line thickness, run and curl alike. */
  thickness: number;
  unit: 'em' | 'px';
  /** Bean radius in curl units (the curl is 60 wide). */
  beanRadius: number;
  /** Bean fill. */
  bean: string;
  /** Position of the line's top edge, e.g. `bottom-0` or `top-0`. */
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // The parent's width and the size of one `unit`, both in CSS px.
  const [box, setBox] = useState<{ w: number; k: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      const k = unit === 'em' ? parseFloat(getComputedStyle(el).fontSize) || 16 : 1;
      setBox((prev) => (prev && prev.w === w && prev.k === k ? prev : { w, k }));
    };
    measure();
    // Width follows the phrase and the breakpoints (the font size changes
    // the phrase's width with it).
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [unit]);

  let svg = null;
  if (box && box.w > 0) {
    const t = thickness * box.k; // line, px
    const s = (width * box.k) / VB_W; // px per curl unit
    const x = box.w - width * box.k; // where the curl's footprint begins
    const y = t / 2; // the run's centre line: its top edge sits on the box top
    const X = (n: number) => +(x + n * s).toFixed(3);
    const Y = (n: number) => +(n * s).toFixed(3);
    const h = VB_H * s;
    // Round caps on a line that starts at x = t/2 put its left edge at 0.
    const d =
      `M${+(t / 2).toFixed(3)} ${+y.toFixed(3)}H${X(22)}` +
      `C${X(40)} ${+y.toFixed(3)} ${X(48)} ${Y(16)} ${X(40)} ${Y(28)}` +
      `C${X(37)} ${Y(33)} ${X(31)} ${Y(34)} ${X(27)} ${Y(30)}`;
    svg = (
      <svg
        width={box.w}
        height={h}
        viewBox={`0 0 ${box.w} ${h}`}
        className="absolute left-0 top-0 block overflow-visible"
      >
        <path d={d} fill="none" stroke="currentColor" strokeWidth={t} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={X(27)} cy={Y(30)} r={+(beanRadius * s).toFixed(3)} fill={bean} />
      </svg>
    );
  }

  return (
    <span
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 block ${className}`}
      style={{ height: `${thickness}${unit}` }}
    >
      {svg}
    </span>
  );
}

/** The curl's height for a given footprint — for reserving room below. */
export function tailHeight(width: number): number {
  return (VB_H * width) / VB_W;
}

import type { Frame } from "../types.js";

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpFrame(from: Frame, to: Frame, t: number, delay: number): Frame {
  return {
    s0: lerp(from.s0, to.s0, t),
    s1: lerp(from.s1, to.s1, t),
    s2: lerp(from.s2, to.s2, t),
    s3: lerp(from.s3, to.s3, t),
    s4: lerp(from.s4, to.s4, t),
    delay,
  };
}

/**
 * Insert interpolated frames between each pair of keyframes.
 * @param frames - Keyframes from the LLM
 * @param steps - Number of intermediate frames to insert between each pair
 * @returns Smoothed frame sequence
 */
export function interpolateFrames(frames: Frame[], steps: number): Frame[] {
  if (frames.length <= 1 || steps <= 0) return frames;

  const result: Frame[] = [frames[0]];

  for (let i = 1; i < frames.length; i++) {
    const from = frames[i - 1];
    const to = frames[i];
    const stepDelay = Math.round(to.delay / steps);

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      result.push(lerpFrame(from, to, t, stepDelay));
    }
  }

  return result;
}

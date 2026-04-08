import { describe, it, expect } from "vitest";
import { interpolateFrames } from "../../src/motion/interpolator.js";
import type { Frame } from "../../src/types.js";

describe("interpolateFrames", () => {
  it("returns single frame as-is", () => {
    const frames: Frame[] = [{ s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, delay: 100 }];
    const result = interpolateFrames(frames, 5);
    expect(result).toEqual(frames);
  });

  it("interpolates between two frames", () => {
    const frames: Frame[] = [
      { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, delay: 100 },
      { s0: 100, s1: 50, s2: 0, s3: 0, s4: 0, delay: 100 },
    ];
    const result = interpolateFrames(frames, 4);
    expect(result).toHaveLength(5);
    expect(result[0].s0).toBe(0);
    expect(result[2].s0).toBe(50);
    expect(result[2].s1).toBe(25);
    expect(result[4].s0).toBe(100);
    expect(result[4].s1).toBe(50);
  });

  it("preserves delay from target frame for interpolated steps", () => {
    const frames: Frame[] = [
      { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, delay: 100 },
      { s0: 180, s1: 0, s2: 0, s3: 0, s4: 0, delay: 200 },
    ];
    const result = interpolateFrames(frames, 2);
    expect(result[1].delay).toBe(100);
    expect(result[2].delay).toBe(100);
  });

  it("handles zero interpolation steps (no smoothing)", () => {
    const frames: Frame[] = [
      { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, delay: 100 },
      { s0: 180, s1: 0, s2: 0, s3: 0, s4: 0, delay: 100 },
    ];
    const result = interpolateFrames(frames, 0);
    expect(result).toEqual(frames);
  });
});

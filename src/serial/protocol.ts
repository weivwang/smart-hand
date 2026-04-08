import type { Frame } from "../types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Encode a Frame into a serial command string for Arduino */
export function encodeFrame(frame: Frame): string {
  const s0 = Math.round(clamp(frame.s0, 0, 180));
  const s1 = Math.round(clamp(frame.s1, 0, 180));
  const s2 = Math.round(clamp(frame.s2, 0, 180));
  const s3 = Math.round(clamp(frame.s3, 0, 180));
  const s4 = Math.round(clamp(frame.s4, 0, 180));
  return `S0:${s0},S1:${s1},S2:${s2},S3:${s3},S4:${s4}\n`;
}

/** Decode Arduino's response — returns true if acknowledged */
export function decodeResponse(data: string): boolean {
  return data.trim() === "OK";
}

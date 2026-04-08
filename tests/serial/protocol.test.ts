import { describe, it, expect } from "vitest";
import { encodeFrame, decodeResponse } from "../../src/serial/protocol.js";
import type { Frame } from "../../src/types.js";

describe("encodeFrame", () => {
  it("encodes a frame to serial string", () => {
    const frame: Frame = { s0: 90, s1: 45, s2: 120, s3: 90, s4: 60, delay: 100 };
    expect(encodeFrame(frame)).toBe("S0:90,S1:45,S2:120,S3:90,S4:60\n");
  });

  it("clamps angles to 0-180 range", () => {
    const frame: Frame = { s0: -10, s1: 200, s2: 90, s3: 0, s4: 180, delay: 100 };
    expect(encodeFrame(frame)).toBe("S0:0,S1:180,S2:90,S3:0,S4:180\n");
  });

  it("rounds fractional angles to integers", () => {
    const frame: Frame = { s0: 90.7, s1: 44.2, s2: 120, s3: 90, s4: 60, delay: 100 };
    expect(encodeFrame(frame)).toBe("S0:91,S1:44,S2:120,S3:90,S4:60\n");
  });
});

describe("decodeResponse", () => {
  it("recognizes OK response", () => {
    expect(decodeResponse("OK")).toBe(true);
  });

  it("recognizes OK with trailing whitespace", () => {
    expect(decodeResponse("OK\r")).toBe(true);
  });

  it("returns false for non-OK response", () => {
    expect(decodeResponse("ERR")).toBe(false);
  });
});

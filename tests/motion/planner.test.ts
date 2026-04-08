import { describe, it, expect } from "vitest";
import { parseLLMResponse } from "../../src/motion/planner.js";

describe("parseLLMResponse", () => {
  it("parses valid JSON response", () => {
    const raw = '{"frames": [{"s0": 0, "s1": 180, "s2": 180, "s3": 0, "s4": 0, "delay": 100}]}';
    const plan = parseLLMResponse(raw);
    expect(plan.frames).toHaveLength(1);
    expect(plan.frames[0].s1).toBe(180);
  });

  it("extracts JSON from markdown code block", () => {
    const raw = 'Here is the motion:\n```json\n{"frames": [{"s0": 90, "s1": 90, "s2": 90, "s3": 90, "s4": 90, "delay": 100}]}\n```';
    const plan = parseLLMResponse(raw);
    expect(plan.frames).toHaveLength(1);
    expect(plan.frames[0].s0).toBe(90);
  });

  it("extracts JSON embedded in text", () => {
    const raw = 'I will make the peace sign. {"frames": [{"s0": 180, "s1": 0, "s2": 0, "s3": 180, "s4": 180, "delay": 100}]} This should work.';
    const plan = parseLLMResponse(raw);
    expect(plan.frames).toHaveLength(1);
  });

  it("clamps out-of-range angles", () => {
    const raw = '{"frames": [{"s0": -20, "s1": 200, "s2": 90, "s3": 90, "s4": 90, "delay": 100}]}';
    const plan = parseLLMResponse(raw);
    expect(plan.frames[0].s0).toBe(0);
    expect(plan.frames[0].s1).toBe(180);
  });

  it("throws on completely invalid response", () => {
    expect(() => parseLLMResponse("I cannot do that")).toThrow();
  });

  it("uses default delay when missing", () => {
    const raw = '{"frames": [{"s0": 0, "s1": 0, "s2": 0, "s3": 0, "s4": 0}]}';
    const plan = parseLLMResponse(raw);
    expect(plan.frames[0].delay).toBe(100);
  });
});

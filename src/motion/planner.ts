import type { Frame, MotionPlan } from "../types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractJSON(raw: string): string {
  // Try markdown code block first
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Try to find a JSON object with "frames"
  const jsonMatch = raw.match(/\{[\s\S]*"frames"[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  throw new Error(`No valid JSON found in LLM response: ${raw.slice(0, 200)}`);
}

function validateFrame(obj: Record<string, unknown>): Frame {
  return {
    s0: clamp(Number(obj.s0 ?? 90), 0, 180),
    s1: clamp(Number(obj.s1 ?? 90), 0, 180),
    s2: clamp(Number(obj.s2 ?? 90), 0, 180),
    s3: clamp(Number(obj.s3 ?? 90), 0, 180),
    s4: clamp(Number(obj.s4 ?? 90), 0, 180),
    delay: Number(obj.delay ?? 100),
  };
}

/** Parse LLM text response into a validated MotionPlan */
export function parseLLMResponse(raw: string): MotionPlan {
  const jsonStr = extractJSON(raw);
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed.frames) || parsed.frames.length === 0) {
    throw new Error("LLM response missing 'frames' array or it is empty.");
  }

  const frames: Frame[] = parsed.frames.map((f: Record<string, unknown>) =>
    validateFrame(f),
  );

  return { frames };
}

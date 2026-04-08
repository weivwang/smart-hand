import { describe, it, expect, vi } from "vitest";
import { DeepSeekProvider } from "../../src/llm/deepseek.js";

// Mock the openai module
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: '{"frames": [{"s0": 180, "s1": 0, "s2": 0, "s3": 180, "s4": 180, "delay": 100}]}',
                },
              },
            ],
          }),
        },
      };

      constructor(public opts: Record<string, unknown>) {}
    },
  };
});

describe("DeepSeekProvider", () => {
  it("returns a valid MotionPlan for a gesture command", async () => {
    const provider = new DeepSeekProvider(
      "test-key",
      "deepseek-chat",
      "https://api.deepseek.com",
    );
    const plan = await provider.infer("比个耶");
    expect(plan.frames).toHaveLength(1);
    expect(plan.frames[0].s1).toBe(0); // index finger straight
    expect(plan.frames[0].s2).toBe(0); // middle finger straight
  });

  it("throws on empty response", async () => {
    const provider = new DeepSeekProvider(
      "test-key",
      "deepseek-chat",
      "https://api.deepseek.com",
    );
    // Override mock to return empty
    vi.mocked(
      (provider as any).client.chat.completions.create,
    ).mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });
    await expect(provider.infer("test")).rejects.toThrow();
  });
});

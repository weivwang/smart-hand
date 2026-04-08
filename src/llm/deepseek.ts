import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./prompts.js";
import { parseLLMResponse } from "../motion/planner.js";
import type { LLMProvider, MotionPlan } from "../types.js";

export class DeepSeekProvider implements LLMProvider {
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model: string = "deepseek-chat",
    baseURL: string = "https://api.deepseek.com",
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async infer(text: string): Promise<MotionPlan> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM returned empty response.");
    }

    return parseLLMResponse(content);
  }
}

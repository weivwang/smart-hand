import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./prompts.js";
import { parseLLMResponse } from "../motion/planner.js";
import type { LLMProvider, MotionPlan } from "../types.js";

export class OllamaProvider implements LLMProvider {
  private client: OpenAI;

  constructor(
    private model: string = "llama3",
    baseURL: string = "http://localhost:11434/v1",
  ) {
    this.client = new OpenAI({ apiKey: "ollama", baseURL });
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

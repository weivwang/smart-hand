import type { AppConfig, LLMProvider } from "../types.js";
import { DeepSeekProvider } from "./deepseek.js";
import { OllamaProvider } from "./ollama.js";

export function createLLMProvider(config: AppConfig): LLMProvider {
  switch (config.llm.provider) {
    case "deepseek":
      return new DeepSeekProvider(
        config.llm.deepseek.apiKey,
        config.llm.deepseek.model,
        config.llm.deepseek.baseUrl,
      );
    case "ollama":
      return new OllamaProvider(
        config.llm.ollama.model,
        config.llm.ollama.baseUrl,
      );
    default:
      throw new Error(`Unknown LLM provider: ${config.llm.provider}`);
  }
}

/** A single frame: angle (0-180) for each of 5 servos */
export interface Frame {
  s0: number; // thumb
  s1: number; // index
  s2: number; // middle
  s3: number; // ring
  s4: number; // pinky
  delay: number; // ms to hold this frame before next
}

/** A sequence of frames forming a complete motion */
export interface MotionPlan {
  frames: Frame[];
}

/** Abstract LLM provider interface */
export interface LLMProvider {
  infer(text: string): Promise<MotionPlan>;
}

/** Application configuration */
export interface AppConfig {
  llm: {
    provider: "deepseek" | "ollama";
    deepseek: {
      apiKey: string;
      model: string;
      baseUrl: string;
    };
    ollama: {
      model: string;
      baseUrl: string;
    };
  };
  audio: {
    whisperApiKey: string;
    silenceThreshold: number;
  };
  serial: {
    baudRate: number;
    autoDetect: boolean;
    port?: string;
  };
  motion: {
    interpolationSteps: number;
    frameDelay: number;
  };
}

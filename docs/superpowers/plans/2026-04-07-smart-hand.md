# Smart Hand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered robotic hand that listens to voice commands and executes any gesture by having an LLM reason about finger positions in real-time.

**Architecture:** TypeScript app on laptop captures voice → Whisper API transcribes → DeepSeek LLM infers per-finger servo angles → sends angles over USB serial to Arduino → Arduino drives 5 servos via PCA9685. Each layer is an independent module with clear interfaces.

**Tech Stack:** TypeScript, Node.js, DeepSeek API (OpenAI-compatible), OpenAI Whisper API, serialport, node-record-lpcm16, Arduino C++ with Adafruit_PWMServoDriver

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/config.ts` | Load and validate YAML config, export typed config object |
| `src/types.ts` | All shared types: Frame, MotionPlan, LLMProvider interface, Config types |
| `src/serial/protocol.ts` | Encode Frame → serial string, decode Arduino response |
| `src/serial/connection.ts` | Manage USB serial port: auto-detect, open, send, reconnect |
| `src/motion/interpolator.ts` | Linear interpolation between frames |
| `src/motion/planner.ts` | Parse LLM JSON output into validated MotionPlan |
| `src/llm/prompts.ts` | System prompt template for the robotic hand |
| `src/llm/deepseek.ts` | DeepSeek LLMProvider implementation |
| `src/llm/ollama.ts` | Ollama LLMProvider implementation |
| `src/llm/provider.ts` | Factory function to create LLMProvider from config |
| `src/audio/recorder.ts` | Microphone recording with VAD silence detection |
| `src/audio/transcriber.ts` | Whisper API speech-to-text |
| `src/ui/terminal.ts` | Terminal status display and logging |
| `src/index.ts` | Main loop wiring all modules together |
| `firmware/smart_hand.ino` | Arduino firmware: parse serial commands, drive servos |
| `config/default.yaml` | Default configuration file |
| `tests/serial/protocol.test.ts` | Tests for protocol encoding/decoding |
| `tests/motion/interpolator.test.ts` | Tests for frame interpolation |
| `tests/motion/planner.test.ts` | Tests for LLM output parsing |
| `tests/llm/deepseek.test.ts` | Tests for DeepSeek provider |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/types.ts`
- Create: `config/default.yaml`
- Create: `src/config.ts`
- Create: `.env.example`

- [ ] **Step 1: Initialize Node.js project**

Run:
```bash
cd /Users/wangweiwei/AI/smart-hand
npm init -y
```

Expected: `package.json` created.

- [ ] **Step 2: Install core dependencies**

Run:
```bash
npm install openai serialport @serialport/parser-readline yaml dotenv
npm install -D typescript @types/node vitest
```

Expected: All packages installed, `node_modules/` created.

- [ ] **Step 3: Create tsconfig.json**

Write `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create shared types**

Write `src/types.ts`:
```typescript
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
```

- [ ] **Step 5: Create default config**

Write `config/default.yaml`:
```yaml
llm:
  provider: deepseek
  deepseek:
    apiKey: ${DEEPSEEK_API_KEY}
    model: deepseek-chat
    baseUrl: https://api.deepseek.com
  ollama:
    model: llama3
    baseUrl: http://localhost:11434/v1

audio:
  whisperApiKey: ${OPENAI_API_KEY}
  silenceThreshold: 1500

serial:
  baudRate: 115200
  autoDetect: true

motion:
  interpolationSteps: 5
  frameDelay: 100
```

- [ ] **Step 6: Create config loader**

Write `src/config.ts`:
```typescript
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse } from "yaml";
import { config as loadEnv } from "dotenv";
import type { AppConfig } from "./types.js";

loadEnv();

function resolveEnvVars(str: string): string {
  return str.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? "");
}

function resolveEnvInObj(obj: unknown): unknown {
  if (typeof obj === "string") return resolveEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(resolveEnvInObj);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveEnvInObj(v);
    }
    return result;
  }
  return obj;
}

export function loadConfig(
  configPath = resolve(process.cwd(), "config/default.yaml"),
): AppConfig {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parse(raw);
  return resolveEnvInObj(parsed) as AppConfig;
}
```

- [ ] **Step 7: Create .env.example**

Write `.env.example`:
```
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OPENAI_API_KEY=your_openai_api_key_for_whisper_here
```

- [ ] **Step 8: Update .gitignore**

Append to `.gitignore`:
```
node_modules/
dist/
.env
.superpowers/
```

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json src/types.ts src/config.ts config/default.yaml .env.example .gitignore
git commit -m "feat: project scaffolding with types, config loader, and dependencies"
```

---

### Task 2: Serial Protocol

**Files:**
- Create: `src/serial/protocol.ts`
- Create: `tests/serial/protocol.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/serial/protocol.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { encodeFrame, decodeResponse } from "../src/serial/protocol.js";
import type { Frame } from "../src/types.js";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/serial/protocol.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement protocol**

Write `src/serial/protocol.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/serial/protocol.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/serial/protocol.ts tests/serial/protocol.test.ts
git commit -m "feat: serial protocol encoding/decoding with clamping and rounding"
```

---

### Task 3: Serial Connection Manager

**Files:**
- Create: `src/serial/connection.ts`

- [ ] **Step 1: Implement serial connection**

Write `src/serial/connection.ts`:
```typescript
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { encodeFrame, decodeResponse } from "./protocol.js";
import type { Frame } from "../types.js";

export class SerialConnection {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private responseResolve: ((ok: boolean) => void) | null = null;

  constructor(
    private baudRate: number = 115200,
    private autoDetect: boolean = true,
    private portPath?: string,
  ) {}

  /** List available serial ports that look like an Arduino */
  static async detectArduino(): Promise<string | null> {
    const ports = await SerialPort.list();
    const arduino = ports.find(
      (p) =>
        p.manufacturer?.toLowerCase().includes("arduino") ||
        p.vendorId === "2341" ||
        p.path.includes("usbmodem") ||
        p.path.includes("usbserial") ||
        p.path.includes("ttyACM") ||
        p.path.includes("ttyUSB"),
    );
    return arduino?.path ?? null;
  }

  async connect(): Promise<void> {
    let path = this.portPath;

    if (!path && this.autoDetect) {
      path = await SerialConnection.detectArduino();
      if (!path) {
        throw new Error(
          "No Arduino detected. Connect via USB and try again, or set serial.port in config.",
        );
      }
    }

    if (!path) {
      throw new Error("No serial port specified and autoDetect is disabled.");
    }

    return new Promise((resolve, reject) => {
      this.port = new SerialPort({ path, baudRate: this.baudRate }, (err) => {
        if (err) {
          reject(new Error(`Failed to open serial port ${path}: ${err.message}`));
          return;
        }
        this.parser = new ReadlineParser({ delimiter: "\n" });
        this.port!.pipe(this.parser);
        this.parser.on("data", (line: string) => {
          if (this.responseResolve) {
            this.responseResolve(decodeResponse(line));
            this.responseResolve = null;
          }
        });
        // Arduino resets on serial connect — wait for it to boot
        setTimeout(() => resolve(), 2000);
      });
    });
  }

  /** Send a frame and wait for OK. Returns true if acknowledged within timeout. */
  async sendFrame(frame: Frame, timeoutMs = 500): Promise<boolean> {
    if (!this.port?.isOpen) {
      throw new Error("Serial port not connected.");
    }

    const cmd = encodeFrame(frame);

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.responseResolve = null;
        resolve(false);
      }, timeoutMs);

      this.responseResolve = (ok: boolean) => {
        clearTimeout(timer);
        resolve(ok);
      };

      this.port!.write(cmd);
    });
  }

  /** Send a frame, retry once on failure */
  async sendFrameWithRetry(frame: Frame): Promise<boolean> {
    const ok = await this.sendFrame(frame);
    if (ok) return true;
    return this.sendFrame(frame);
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.port?.isOpen) {
        this.port.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  get isConnected(): boolean {
    return this.port?.isOpen ?? false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/serial/connection.ts
git commit -m "feat: serial connection manager with auto-detect and retry"
```

---

### Task 4: Motion Interpolator

**Files:**
- Create: `src/motion/interpolator.ts`
- Create: `tests/motion/interpolator.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/motion/interpolator.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { interpolateFrames } from "../src/motion/interpolator.js";
import type { Frame } from "../src/types.js";

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
    // 4 steps between frame 0 and frame 1 = 5 frames total (including both endpoints)
    expect(result).toHaveLength(5);
    // First frame unchanged
    expect(result[0].s0).toBe(0);
    // Middle frame: halfway
    expect(result[2].s0).toBe(50);
    expect(result[2].s1).toBe(25);
    // Last frame: target
    expect(result[4].s0).toBe(100);
    expect(result[4].s1).toBe(50);
  });

  it("preserves delay from target frame for interpolated steps", () => {
    const frames: Frame[] = [
      { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, delay: 100 },
      { s0: 180, s1: 0, s2: 0, s3: 0, s4: 0, delay: 200 },
    ];
    const result = interpolateFrames(frames, 2);
    // Interpolated frames between should use distributed delay
    // Total delay = 200, steps = 2, so each intermediate = 200/2 = 100
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/motion/interpolator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement interpolator**

Write `src/motion/interpolator.ts`:
```typescript
import type { Frame } from "../types.js";

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpFrame(from: Frame, to: Frame, t: number, delay: number): Frame {
  return {
    s0: lerp(from.s0, to.s0, t),
    s1: lerp(from.s1, to.s1, t),
    s2: lerp(from.s2, to.s2, t),
    s3: lerp(from.s3, to.s3, t),
    s4: lerp(from.s4, to.s4, t),
    delay,
  };
}

/**
 * Insert interpolated frames between each pair of keyframes.
 * @param frames - Keyframes from the LLM
 * @param steps - Number of intermediate frames to insert between each pair
 * @returns Smoothed frame sequence
 */
export function interpolateFrames(frames: Frame[], steps: number): Frame[] {
  if (frames.length <= 1 || steps <= 0) return frames;

  const result: Frame[] = [frames[0]];

  for (let i = 1; i < frames.length; i++) {
    const from = frames[i - 1];
    const to = frames[i];
    const stepDelay = Math.round(to.delay / steps);

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      result.push(lerpFrame(from, to, t, stepDelay));
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/motion/interpolator.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/motion/interpolator.ts tests/motion/interpolator.test.ts
git commit -m "feat: frame interpolator with linear smoothing between keyframes"
```

---

### Task 5: Motion Planner (LLM Output Parser)

**Files:**
- Create: `src/motion/planner.ts`
- Create: `tests/motion/planner.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/motion/planner.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseLLMResponse } from "../src/motion/planner.js";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/motion/planner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement planner**

Write `src/motion/planner.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/motion/planner.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/motion/planner.ts tests/motion/planner.test.ts
git commit -m "feat: LLM output parser with JSON extraction and angle validation"
```

---

### Task 6: LLM Prompt and DeepSeek Provider

**Files:**
- Create: `src/llm/prompts.ts`
- Create: `src/llm/deepseek.ts`
- Create: `src/llm/ollama.ts`
- Create: `src/llm/provider.ts`
- Create: `tests/llm/deepseek.test.ts`

- [ ] **Step 1: Create the system prompt**

Write `src/llm/prompts.ts`:
```typescript
export const SYSTEM_PROMPT = `你正在控制一只机械手。它有5个舵机，分别控制5根手指：
- S0: 拇指
- S1: 食指
- S2: 中指
- S3: 无名指
- S4: 小指

每个舵机的角度范围是 0-180 度：
- 0 = 手指完全伸直
- 180 = 手指完全弯曲（握拳状态）

根据用户的指令，输出 JSON 格式的帧序列。
- 静态手势输出 1 帧
- 动态动作（如弹钢琴、数数、挥手等）输出多帧，形成动画效果

严格按以下 JSON 格式输出，不要输出其他内容：
{
  "frames": [
    { "s0": 角度, "s1": 角度, "s2": 角度, "s3": 角度, "s4": 角度, "delay": 毫秒 }
  ]
}

示例：
- "比耶" → 食指和中指伸直(0)，其余弯曲(180)
- "握拳" → 全部弯曲(180)
- "数到3" → 依次伸出手指的多帧序列

请自主推理每根手指应有的角度，不要要求额外信息。只输出 JSON。`;
```

- [ ] **Step 2: Write the failing test for DeepSeek provider**

Write `tests/llm/deepseek.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { DeepSeekProvider } from "../src/llm/deepseek.js";

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
    const { default: MockOpenAI } = await import("openai");
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/llm/deepseek.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement DeepSeek provider**

Write `src/llm/deepseek.ts`:
```typescript
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
```

- [ ] **Step 5: Implement Ollama provider**

Write `src/llm/ollama.ts`:
```typescript
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
```

- [ ] **Step 6: Implement provider factory**

Write `src/llm/provider.ts`:
```typescript
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/llm/deepseek.test.ts`
Expected: All 2 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/llm/prompts.ts src/llm/deepseek.ts src/llm/ollama.ts src/llm/provider.ts tests/llm/deepseek.test.ts
git commit -m "feat: LLM provider layer with DeepSeek (default) and Ollama support"
```

---

### Task 7: Audio Recorder and Transcriber

**Files:**
- Create: `src/audio/recorder.ts`
- Create: `src/audio/transcriber.ts`

- [ ] **Step 1: Install audio dependencies**

Run:
```bash
npm install node-record-lpcm16 openai
npm install -D @types/node-record-lpcm16
```

Note: `openai` is already installed (used by LLM layer) — npm will skip it. `node-record-lpcm16` requires `sox` to be installed on the system. On macOS: `brew install sox`. On Ubuntu: `sudo apt install sox`.

- [ ] **Step 2: Implement audio recorder with VAD**

Write `src/audio/recorder.ts`:
```typescript
import record from "node-record-lpcm16";
import type { ChildProcess } from "child_process";

export interface RecorderOptions {
  sampleRate?: number;
  silenceThreshold?: number; // ms of silence before stopping
}

/**
 * Record audio from microphone with simple VAD.
 * Starts recording when called, stops after `silenceThreshold` ms of silence.
 * Returns the raw PCM audio as a Buffer.
 */
export function recordUntilSilence(
  options: RecorderOptions = {},
): Promise<Buffer> {
  const { sampleRate = 16000, silenceThreshold = 1500 } = options;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let silenceTimer: NodeJS.Timeout | null = null;
    let hasSound = false;

    const recording = record.record({
      sampleRate,
      channels: 1,
      audioType: "wav",
      recorder: "sox",
    });

    const stream = recording.stream();

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);

      // Simple energy-based VAD: check if chunk has audio above threshold
      const energy = chunk.reduce((sum, byte) => sum + Math.abs(byte - 128), 0) / chunk.length;
      const isSilent = energy < 5;

      if (!isSilent) {
        hasSound = true;
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      } else if (hasSound && !silenceTimer) {
        silenceTimer = setTimeout(() => {
          recording.stop();
        }, silenceThreshold);
      }
    });

    stream.on("end", () => {
      if (chunks.length === 0) {
        reject(new Error("No audio recorded."));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    stream.on("error", (err: Error) => {
      reject(err);
    });
  });
}
```

- [ ] **Step 3: Implement Whisper transcriber**

Write `src/audio/transcriber.ts`:
```typescript
import OpenAI from "openai";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export class Transcriber {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Transcribe audio buffer to text using Whisper API.
   * Retries once on failure.
   */
  async transcribe(audioBuffer: Buffer): Promise<string> {
    // Whisper API needs a file — write to temp
    const tmpPath = join(tmpdir(), `smart-hand-${Date.now()}.wav`);

    try {
      writeFileSync(tmpPath, audioBuffer);

      const file = new File(
        [new Blob([audioBuffer])],
        "audio.wav",
        { type: "audio/wav" },
      );

      const result = await this.callWhisper(file);
      return result;
    } catch (err) {
      // Retry once
      try {
        const file = new File(
          [new Blob([audioBuffer])],
          "audio.wav",
          { type: "audio/wav" },
        );
        return await this.callWhisper(file);
      } catch (retryErr) {
        throw new Error(
          `Whisper transcription failed after retry: ${(retryErr as Error).message}`,
        );
      }
    } finally {
      try {
        unlinkSync(tmpPath);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  private async callWhisper(file: File): Promise<string> {
    const response = await this.client.audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: "zh",
    });
    return response.text;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/audio/recorder.ts src/audio/transcriber.ts
git commit -m "feat: audio recorder with VAD and Whisper transcriber"
```

---

### Task 8: Terminal UI

**Files:**
- Create: `src/ui/terminal.ts`

- [ ] **Step 1: Implement terminal UI**

Write `src/ui/terminal.ts`:
```typescript
type Status = "waiting" | "recording" | "transcribing" | "thinking" | "executing" | "error";

const STATUS_LABELS: Record<Status, string> = {
  waiting: "🎤 等待语音输入...",
  recording: "🔴 录音中...",
  transcribing: "📝 语音识别中...",
  thinking: "🧠 AI 推理中...",
  executing: "⚙️  执行动作中...",
  error: "❌ 出错了",
};

export class TerminalUI {
  private currentStatus: Status = "waiting";

  setStatus(status: Status): void {
    this.currentStatus = status;
    this.clearLine();
    process.stdout.write(`\r${STATUS_LABELS[status]}`);
  }

  /** Log a message on a new line, then restore status line */
  log(label: string, message: string): void {
    this.clearLine();
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    console.log(`[${time}] ${label}: ${message}`);
    process.stdout.write(STATUS_LABELS[this.currentStatus]);
  }

  logTranscription(text: string): void {
    this.log("👤 你说", text);
  }

  logLLMResult(framesCount: number): void {
    this.log("🤖 AI", `生成了 ${framesCount} 帧动作序列`);
  }

  logError(message: string): void {
    this.log("❌ 错误", message);
  }

  logReady(): void {
    console.log("");
    console.log("╔══════════════════════════════════════╗");
    console.log("║   🤖 Smart Hand — AI 语音控制机械手   ║");
    console.log("║   说话即可控制，Ctrl+C 退出           ║");
    console.log("╚══════════════════════════════════════╝");
    console.log("");
  }

  private clearLine(): void {
    process.stdout.write("\r\x1b[K");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/terminal.ts
git commit -m "feat: terminal UI with status display and logging"
```

---

### Task 9: Main Loop

**Files:**
- Create: `src/index.ts`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Implement main loop**

Write `src/index.ts`:
```typescript
import { loadConfig } from "./config.js";
import { createLLMProvider } from "./llm/provider.js";
import { Transcriber } from "./audio/transcriber.js";
import { recordUntilSilence } from "./audio/recorder.js";
import { interpolateFrames } from "./motion/interpolator.js";
import { SerialConnection } from "./serial/connection.js";
import { TerminalUI } from "./ui/terminal.js";
import type { Frame } from "./types.js";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const ui = new TerminalUI();
  const config = loadConfig();

  ui.logReady();

  // Initialize LLM provider
  const llm = createLLMProvider(config);
  console.log(`✅ LLM provider: ${config.llm.provider}`);

  // Initialize transcriber
  const transcriber = new Transcriber(config.audio.whisperApiKey);
  console.log("✅ Whisper transcriber ready");

  // Initialize serial connection
  const serial = new SerialConnection(
    config.serial.baudRate,
    config.serial.autoDetect,
    config.serial.port,
  );

  try {
    ui.setStatus("waiting");
    console.log("🔌 Connecting to Arduino...");
    await serial.connect();
    console.log("✅ Arduino connected");
  } catch (err) {
    console.log(`⚠️  Arduino not connected: ${(err as Error).message}`);
    console.log("   Running in simulation mode (commands printed to terminal)");
  }

  console.log("\n🎤 开始说话吧！\n");

  // Main loop
  while (true) {
    try {
      // 1. Wait for voice input
      ui.setStatus("waiting");
      const audioBuffer = await recordUntilSilence({
        silenceThreshold: config.audio.silenceThreshold,
      });

      // 2. Transcribe
      ui.setStatus("transcribing");
      const text = await transcriber.transcribe(audioBuffer);

      if (!text.trim()) {
        ui.logError("未识别到有效语音");
        continue;
      }

      ui.logTranscription(text);

      // 3. LLM inference
      ui.setStatus("thinking");
      const plan = await llm.infer(text);
      ui.logLLMResult(plan.frames.length);

      // 4. Interpolate
      const smoothFrames = interpolateFrames(
        plan.frames,
        config.motion.interpolationSteps,
      );

      // 5. Execute
      ui.setStatus("executing");
      for (const frame of smoothFrames) {
        if (serial.isConnected) {
          await serial.sendFrameWithRetry(frame);
        } else {
          // Simulation mode: print frame
          ui.log("📤 模拟", `S0:${frame.s0} S1:${frame.s1} S2:${frame.s2} S3:${frame.s3} S4:${frame.s4}`);
        }
        await sleep(frame.delay);
      }

      ui.log("✅ 完成", `执行了 ${smoothFrames.length} 帧`);
    } catch (err) {
      ui.setStatus("error");
      ui.logError((err as Error).message);
      // Brief pause before next cycle
      await sleep(1000);
    }
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Add scripts to package.json**

Add these to the `"scripts"` section of `package.json`:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node --loader ts-node/esm src/index.ts",
    "dev": "npx tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Also install tsx for dev mode:
```bash
npm install -D tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/index.ts package.json
git commit -m "feat: main loop wiring all modules together"
```

---

### Task 10: Arduino Firmware

**Files:**
- Create: `firmware/smart_hand.ino`

- [ ] **Step 1: Write Arduino firmware**

Write `firmware/smart_hand.ino`:
```cpp
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// PCA9685 driver — default I2C address 0x40
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

// Servo pulse range (adjust after calibration)
#define SERVO_MIN 150  // pulse length for 0 degrees
#define SERVO_MAX 600  // pulse length for 180 degrees
#define NUM_SERVOS 5

String inputBuffer = "";

void setup() {
  Serial.begin(115200);
  pwm.begin();
  pwm.setPWMFreq(50); // Standard servo frequency

  // Move all servos to 90 degrees (neutral) on startup
  for (int i = 0; i < NUM_SERVOS; i++) {
    setServoAngle(i, 90);
  }

  Serial.println("READY");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      processCommand(inputBuffer);
      inputBuffer = "";
    } else {
      inputBuffer += c;
    }
  }
}

void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  // Parse format: "S0:90,S1:45,S2:120,S3:90,S4:60"
  int servo = 0;
  int startIdx = 0;

  while (startIdx < (int)cmd.length() && servo < NUM_SERVOS) {
    // Find "S<n>:" prefix
    int colonIdx = cmd.indexOf(':', startIdx);
    if (colonIdx == -1) break;

    // Find end of value (comma or end of string)
    int commaIdx = cmd.indexOf(',', colonIdx);
    if (commaIdx == -1) commaIdx = cmd.length();

    // Extract angle value
    String valueStr = cmd.substring(colonIdx + 1, commaIdx);
    int angle = valueStr.toInt();
    angle = constrain(angle, 0, 180);

    setServoAngle(servo, angle);
    servo++;
    startIdx = commaIdx + 1;
  }

  Serial.println("OK");
}

void setServoAngle(int channel, int angle) {
  int pulse = map(angle, 0, 180, SERVO_MIN, SERVO_MAX);
  pwm.setPWM(channel, 0, pulse);
}
```

- [ ] **Step 2: Commit**

```bash
git add firmware/smart_hand.ino
git commit -m "feat: Arduino firmware for PCA9685 servo control via serial"
```

---

### Task 11: README and Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Write `README.md`:
```markdown
# 🤖 Smart Hand — AI 语音控制机械手

> 用自然语言控制一只机械手做出任意手势。AI 不是查表，而是直接推理每根手指该怎么动。

说 "比个耶" → AI 推理出食指和中指伸直 → 机械手做出手势

说 "假装弹钢琴" → AI 生成手指交替按下的动画序列 → 机械手弹起来

## ✨ 核心创新

传统方案：语音 → 匹配预定义手势 → 查表执行（本质是分类器）

**Smart Hand：语音 → LLM 直接推理每根手指的弯曲角度 → 执行任意动作**

LLM 的世界知识就是你的手势库 — 无需提前定义任何手势。

## 🏗️ 架构

```
语音 → Whisper(语音转文字) → DeepSeek(推理手指角度) → Arduino → 5个舵机 → 机械手
```

## 📦 硬件清单

| 组件 | 参考价格 |
|------|---------|
| 5自由度机械手爪套件（含舵机） | ¥150-400 |
| Arduino Mega 2560 | ¥45 |
| PCA9685 舵机驱动板 | ¥15 |
| 5V 5A 电源适配器 | ¥25 |
| 杜邦线、USB数据线 | ¥20 |

**总计：¥250 - ¥500**

## 🔌 接线

1. Arduino Mega → PCA9685（I2C：SDA/SCL）
2. PCA9685 通道 0-4 → 5个舵机
3. PCA9685 → 独立 5V 5A 电源
4. Arduino → 笔记本（USB）

## 🚀 快速开始

### 前置条件

- Node.js >= 18
- macOS: `brew install sox` / Ubuntu: `sudo apt install sox`
- Arduino IDE（用于烧录固件）

### 1. 烧录 Arduino 固件

1. 用 Arduino IDE 打开 `firmware/smart_hand.ino`
2. 安装库：Adafruit PWM Servo Driver Library
3. 选择 Arduino Mega 2560，上传

### 2. 安装软件

```bash
git clone https://github.com/your-name/smart-hand.git
cd smart-hand
npm install
cp .env.example .env
```

编辑 `.env`，填入你的 API Key：
```
DEEPSEEK_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  # for Whisper
```

### 3. 运行

```bash
npm run dev
```

然后对着麦克风说话！

## ⚙️ 配置

编辑 `config/default.yaml` 可以：

- 切换 LLM 提供商（DeepSeek / Ollama）
- 调整舵机参数
- 修改语音检测灵敏度

### 使用本地模型（Ollama）

```yaml
llm:
  provider: ollama
  ollama:
    model: llama3
    baseUrl: http://localhost:11434/v1
```

## 📄 License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions and architecture overview"
```

---

## Self-Review Checklist

- **Spec coverage:** ✅ All sections covered — types, config, serial (protocol + connection), motion (interpolator + planner), LLM (prompts + deepseek + ollama + factory), audio (recorder + transcriber), UI, main loop, Arduino firmware, README.
- **Placeholder scan:** ✅ No TBD/TODO/placeholder text. All code steps have complete code blocks.
- **Type consistency:** ✅ `Frame`, `MotionPlan`, `LLMProvider`, `AppConfig` used consistently across all tasks. `encodeFrame`, `decodeResponse`, `parseLLMResponse`, `interpolateFrames`, `createLLMProvider` — all names match between definition and usage.
- **Missing from spec:** Demo video script — this is a non-code activity, already documented in the design spec. Error handling — covered in planner (JSON extraction retry), connection (retry), transcriber (retry), main loop (catch + continue).

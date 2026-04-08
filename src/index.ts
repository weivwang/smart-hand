import { loadConfig } from "./config.js";
import { createLLMProvider } from "./llm/provider.js";
import { Transcriber } from "./audio/transcriber.js";
import { recordUntilSilence } from "./audio/recorder.js";
import { interpolateFrames } from "./motion/interpolator.js";
import { SerialConnection } from "./serial/connection.js";
import { TerminalUI } from "./ui/terminal.js";

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

import { execFile } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { resolve } from "path";

export class Transcriber {
  private modelPath: string;

  constructor(modelPath?: string) {
    this.modelPath = modelPath ?? resolve(process.cwd(), "models/ggml-small.bin");
  }

  /**
   * Transcribe audio buffer to text using local whisper-cli.
   * No API key needed — runs entirely on your machine.
   */
  async transcribe(audioBuffer: Buffer): Promise<string> {
    const tmpPath = join(tmpdir(), `smart-hand-${Date.now()}.wav`);

    try {
      writeFileSync(tmpPath, audioBuffer);

      const text = await this.callWhisper(tmpPath);
      return text.trim();
    } finally {
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  private callWhisper(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "whisper-cli",
        [
          "-m", this.modelPath,
          "-f", filePath,
          "-l", "zh",
          "--no-timestamps",
          "-np",        // no progress
        ],
        { timeout: 30000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Whisper failed: ${error.message}\n${stderr}`));
            return;
          }
          // whisper-cli outputs transcription to stdout
          const text = stdout
            .split("\n")
            .filter((line) => !line.startsWith("whisper_") && line.trim().length > 0)
            .join(" ")
            .trim();
          resolve(text);
        },
      );
    });
  }
}

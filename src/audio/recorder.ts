import record from "node-record-lpcm16";

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

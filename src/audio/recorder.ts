import record from "node-record-lpcm16";

export interface RecorderOptions {
  sampleRate?: number;
  silenceThreshold?: number; // ms of silence before stopping
  maxDuration?: number; // ms, max recording time (safety timeout)
}

/**
 * Compute RMS energy from a 16-bit signed LE audio buffer.
 * Returns a value between 0 (silence) and ~32768 (max volume).
 */
function computeRMS(chunk: Buffer): number {
  const samples = Math.floor(chunk.length / 2);
  if (samples === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples; i++) {
    const sample = chunk.readInt16LE(i * 2);
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples);
}

/**
 * Record audio from microphone with simple VAD.
 * Starts recording when called, stops after `silenceThreshold` ms of silence.
 * Returns the raw audio as a Buffer.
 */
export function recordUntilSilence(
  options: RecorderOptions = {},
): Promise<Buffer> {
  const {
    sampleRate = 16000,
    silenceThreshold = 1500,
    maxDuration = 30000,
  } = options;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let silenceTimer: NodeJS.Timeout | null = null;
    let maxTimer: NodeJS.Timeout | null = null;
    let hasSound = false;

    const recording = record.record({
      sampleRate,
      channels: 1,
      audioType: "wav",
      recorder: "sox",
    });

    const stream = recording.stream();

    const stopRecording = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (maxTimer) clearTimeout(maxTimer);
      recording.stop();
    };

    // Safety timeout: stop after maxDuration regardless
    maxTimer = setTimeout(() => {
      console.log("[recorder] Max duration reached, stopping.");
      stopRecording();
    }, maxDuration);

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);

      // 16-bit signed LE RMS energy
      const energy = computeRMS(chunk);
      // Threshold ~500 works for typical speech vs background noise
      const isSilent = energy < 500;

      if (!isSilent) {
        hasSound = true;
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      } else if (hasSound && !silenceTimer) {
        silenceTimer = setTimeout(() => {
          stopRecording();
        }, silenceThreshold);
      }
    });

    stream.on("end", () => {
      if (maxTimer) clearTimeout(maxTimer);
      if (chunks.length === 0) {
        reject(new Error("No audio recorded."));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    stream.on("error", (err: Error) => {
      if (maxTimer) clearTimeout(maxTimer);
      reject(err);
    });
  });
}

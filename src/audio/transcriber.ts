import OpenAI from "openai";

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
    try {
      const file = new File(
        [new Blob([audioBuffer])],
        "audio.wav",
        { type: "audio/wav" },
      );
      return await this.callWhisper(file);
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

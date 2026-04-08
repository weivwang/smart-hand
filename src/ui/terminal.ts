type Status = "waiting" | "recording" | "transcribing" | "thinking" | "executing" | "error";

const STATUS_LABELS: Record<Status, string> = {
  waiting: "🎤 按 Enter 开始录音...",
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
    console.log("║   按 Enter 录音，说完自动停止          ║");
    console.log("╚══════════════════════════════════════╝");
    console.log("");
  }

  private clearLine(): void {
    process.stdout.write("\r\x1b[K");
  }
}

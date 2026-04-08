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

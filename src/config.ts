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

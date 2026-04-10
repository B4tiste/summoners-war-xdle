/**
 * env.ts
 *
 * Minimal .env file loader for scripts that run outside Next.js.
 * Reads the .env file from the project root and populates process.env.
 * Does NOT override already-set environment variables.
 */

import fs from "fs";
import path from "path";

export function loadEnv(envFile = ".env"): void {
  const envPath = path.join(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

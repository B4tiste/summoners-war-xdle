/**
 * download-datasets.ts
 *
 * Downloads the raw JSON datasets from external sources and saves them locally.
 * Run with: pnpm data:download
 */

import fs from "fs";
import path from "path";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

const SOURCES = {
  monstersElements: {
    url: "https://raw.githubusercontent.com/B4tiste/BP-data/refs/heads/main/data/monsters_elements.json",
    filename: "monsters_elements.json",
    /** Fallback instructions if the download fails */
    manualInstruction: null,
  },
  lucksackCatalog: {
    url: "https://static.lucksack.gg/data/monsters_catalog.json",
    filename: "monsters_catalog.json",
    /**
     * Lucksack serves this file behind Cloudflare bot protection.
     * If the automatic download fails, open the URL in your browser,
     * then save the JSON to data/raw/monsters_catalog.json manually.
     */
    manualInstruction:
      "Open https://static.lucksack.gg/data/monsters_catalog.json in a browser " +
      "and save the content to data/raw/monsters_catalog.json",
  },
} as const;

async function downloadFile(url: string, destPath: string): Promise<void> {
  console.log(`Downloading ${url} ...`);
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64)",
      "sec-fetch-site": "none",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`
    );
  }
  const text = await response.text();
  fs.writeFileSync(destPath, text, "utf-8");
  console.log(`  -> Saved to ${path.relative(process.cwd(), destPath)}`);
}

async function main(): Promise<void> {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  const errors: string[] = [];

  for (const [key, source] of Object.entries(SOURCES)) {
    const destPath = path.join(RAW_DIR, source.filename);

    // Skip if the file already exists (allows manual placement)
    if (fs.existsSync(destPath)) {
      console.log(`  [skip] ${source.filename} already exists.`);
      continue;
    }

    try {
      await downloadFile(source.url, destPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(`Error downloading ${key}: ${message}`);
      if (source.manualInstruction) {
        console.error(`  Manual fallback: ${source.manualInstruction}`);
      }
      errors.push(`${key}: ${message}`);
    }
  }

  if (errors.length > 0) {
    console.error("\nSome downloads failed:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log("\nAll datasets downloaded successfully.");
}

main();

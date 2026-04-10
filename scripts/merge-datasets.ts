/**
 * merge-datasets.ts
 *
 * Merges the Lucksack catalog and the SWARFARM bestiary into a single
 * RawMergedMonster[] JSON file saved at data/snapshots/merged-monsters.json.
 *
 * Pivot key: com2us_id
 * Run with: pnpm data:merge
 */

import fs from "fs";
import path from "path";
import { LucksackCatalogSchema } from "../src/lib/schemas/lucksack.schema";
import { SwarfarmBestiaryFileSchema } from "../src/lib/schemas/swarfarm.schema";
import { mergeMonsterSources, type RawMergedMonster } from "../src/lib/domain/monster";

const RAW_DIR = path.join(process.cwd(), "data", "raw");
const SNAPSHOTS_DIR = path.join(process.cwd(), "data", "snapshots");
const OUTPUT_PATH = path.join(SNAPSHOTS_DIR, "merged-monsters.json");

function readAndParse<T>(
  filePath: string,
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { message: string } } }
): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File not found: ${filePath}. Run \`pnpm data:download\` first.`
    );
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Validation error in ${filePath}: ${result.error.message}`
    );
  }
  return result.data;
}

function main(): void {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  console.log("Loading Lucksack catalog...");
  const lucksackEntries = readAndParse(
    path.join(RAW_DIR, "monsters_catalog.json"),
    LucksackCatalogSchema
  );
  console.log(`  ${lucksackEntries.length} entries found.`);

  console.log("Loading SWARFARM bestiary...");
  const swarfarmFile = readAndParse(
    path.join(RAW_DIR, "monsters_elements.json"),
    SwarfarmBestiaryFileSchema
  );
  const swarfarmEntries = swarfarmFile.monsters;
  console.log(`  ${swarfarmEntries.length} entries found.`);

  // Build a lookup map from com2us_id to SWARFARM entry
  const swarfarmMap = new Map(
    swarfarmEntries.map((e) => [e.com2us_id, e])
  );

  const merged: RawMergedMonster[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const lucksack of lucksackEntries) {
    const swarfarm = swarfarmMap.get(parseInt(lucksack.com2us_id, 10)) ?? null;
    if (swarfarm) {
      matchedCount++;
    } else {
      unmatchedCount++;
    }
    merged.push(mergeMonsterSources(lucksack, swarfarm));
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2), "utf-8");

  console.log(`\nMerge complete:`);
  console.log(`  Total  : ${merged.length}`);
  console.log(`  Matched: ${matchedCount}`);
  console.log(`  Lucksack-only (no SWARFARM data): ${unmatchedCount}`);
  console.log(`  -> Saved to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();

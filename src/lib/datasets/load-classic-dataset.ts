/**
 * load-classic-dataset.ts
 *
 * Loads and validates the generated Classic monster dataset at runtime.
 * The dataset is read from disk (data/generated/classic-monsters.json)
 * so it must be built before starting the Next.js server.
 */

import fs from "fs";
import path from "path";
import {
  ClassicMonsterDatasetSchema,
  type ClassicMonster,
} from "@/lib/schemas/classic-monster.schema";

const DATASET_PATH = path.join(
  process.cwd(),
  "data",
  "generated",
  "classic-monsters.json"
);

/** Cache so the file is parsed only once per process lifetime */
let _cache: ClassicMonster[] | null = null;

/**
 * Returns the full list of ClassicMonster entries.
 * Validates the file with Zod on first load; throws if invalid or missing.
 */
export function loadClassicDataset(): ClassicMonster[] {
  if (_cache !== null) return _cache;

  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(
      `Classic dataset not found at ${DATASET_PATH}. ` +
        "Run `pnpm data:build` to generate it."
    );
  }

  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  const result = ClassicMonsterDatasetSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Classic dataset validation failed: ${result.error.message}`
    );
  }

  _cache = result.data;
  return _cache;
}

/**
 * Finds a single monster by its slug.
 * Returns undefined if not found.
 */
export function findMonsterBySlug(slug: string): ClassicMonster | undefined {
  return loadClassicDataset().find((m) => m.slug === slug);
}

/**
 * Finds a single monster by its com2usId.
 * Returns undefined if not found.
 */
export function findMonsterById(com2usId: number): ClassicMonster | undefined {
  return loadClassicDataset().find((m) => m.com2usId === com2usId);
}

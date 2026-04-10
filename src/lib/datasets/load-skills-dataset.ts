/**
 * load-skills-dataset.ts
 *
 * Loads and validates the Skills monster dataset at runtime.
 * Reads from data/generated/skills-monsters.json.
 */

import fs from "fs";
import path from "path";
import {
  SkillsMonsterDatasetSchema,
  type SkillsMonster,
} from "@/lib/schemas/skills-monster.schema";

const DATASET_PATH = path.join(
  process.cwd(),
  "data",
  "generated",
  "skills-monsters.json"
);

const PUZZLES_PATH = path.join(
  process.cwd(),
  "data",
  "generated",
  "skills-puzzles.json"
);

const FRANCE_TIME_ZONE = "Europe/Paris";

let _datasetCache: SkillsMonster[] | null = null;
let _puzzlesCache: { date: string; mode: string; targetCom2usId: number }[] | null = null;

export function loadSkillsDataset(): SkillsMonster[] {
  if (_datasetCache !== null) return _datasetCache;

  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(
      `Skills dataset not found at ${DATASET_PATH}. Run \`pnpm data:skills:build\` to generate it.`
    );
  }

  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  const result = SkillsMonsterDatasetSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Skills dataset validation failed: ${result.error.message}`);
  }

  _datasetCache = result.data;
  return _datasetCache;
}

export function findSkillsMonsterBySlug(slug: string): SkillsMonster | undefined {
  return loadSkillsDataset().find((m) => m.slug === slug);
}

export function findSkillsMonsterById(com2usId: number): SkillsMonster | undefined {
  return loadSkillsDataset().find((m) => m.com2usId === com2usId);
}

export function todayFranceSkills(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: FRANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return new Date().toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function loadSkillsPuzzles() {
  if (_puzzlesCache !== null) return _puzzlesCache;

  if (!fs.existsSync(PUZZLES_PATH)) {
    throw new Error(
      `Skills puzzles file not found at ${PUZZLES_PATH}. Run \`pnpm data:skills:puzzles\` to generate it.`
    );
  }

  const raw = fs.readFileSync(PUZZLES_PATH, "utf-8");
  _puzzlesCache = JSON.parse(raw) as typeof _puzzlesCache;
  return _puzzlesCache!;
}

export function getDailySkillsTarget(date: string = todayFranceSkills()): SkillsMonster {
  const puzzles = loadSkillsPuzzles();
  const entry = puzzles.find((p) => p.date === date && p.mode === "skills");

  if (!entry) {
    throw new Error(
      `No skills puzzle found for date ${date}. Run \`pnpm data:skills:puzzles\` to regenerate.`
    );
  }

  const monster = findSkillsMonsterById(entry.targetCom2usId);
  if (!monster) {
    throw new Error(
      `Target monster com2usId=${entry.targetCom2usId} not found in skills dataset.`
    );
  }

  return monster;
}

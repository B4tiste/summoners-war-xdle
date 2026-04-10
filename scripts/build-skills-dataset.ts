/**
 * build-skills-dataset.ts
 *
 * Builds the Skills mode monster dataset from merged-monsters.json and
 * the skills-icons-cache.json. Only includes monsters that have at least
 * 2 skill icons (to make the game interesting).
 *
 * Output: data/generated/skills-monsters.json
 *
 * Run with: pnpm data:skills:build
 */

import fs from "fs";
import path from "path";
import type { SkillsMonster } from "../src/lib/schemas/skills-monster.schema";

const MERGED_PATH = path.join(process.cwd(), "data", "snapshots", "merged-monsters.json");
const ICONS_CACHE_PATH = path.join(process.cwd(), "data", "snapshots", "skills-icons-cache.json");
const OUTPUT_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "skills-monsters.json");

interface RawMergedMonster {
  com2usId: number;
  slug: string;
  label: string;
  slabel: string;
  image: string;
  element: string;
  searchable?: boolean;
  obtainable?: boolean | null;
  skillIds: number[];
}

interface SkillIconEntry {
  id: number;
  name: string;
  icon_filename: string;
}

/** Minimum number of skills with icons required for a monster to be eligible */
const MIN_SKILL_ICONS = 2;

function main(): void {
  if (!fs.existsSync(MERGED_PATH)) {
    console.error(`merged-monsters.json not found. Run pnpm data:merge first.`);
    process.exit(1);
  }
  if (!fs.existsSync(ICONS_CACHE_PATH)) {
    console.error(`skills-icons-cache.json not found. Run pnpm data:skills:fetch first.`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allMonsters = JSON.parse(fs.readFileSync(MERGED_PATH, "utf-8")) as RawMergedMonster[];
  const iconsCache = JSON.parse(fs.readFileSync(ICONS_CACHE_PATH, "utf-8")) as Record<string, SkillIconEntry>;

  const skillsMonsters: SkillsMonster[] = [];

  for (const monster of allMonsters) {
    if (!monster.searchable || monster.obtainable === false) continue;

    const skills = (monster.skillIds ?? [])
      .map((id) => {
        const entry = iconsCache[id.toString()];
        if (!entry || !entry.icon_filename) return null;
        return { id: entry.id, name: entry.name, iconFilename: entry.icon_filename };
      })
      .filter((s): s is { id: number; name: string; iconFilename: string } => s !== null);

    if (skills.length < MIN_SKILL_ICONS) continue;

    skillsMonsters.push({
      com2usId: monster.com2usId,
      slug: monster.slug,
      displayName: monster.label,
      image: monster.image,
      element: monster.element,
      skills,
    });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(skillsMonsters, null, 2), "utf-8");
  console.log(`Built skills dataset: ${skillsMonsters.length} eligible monsters -> ${OUTPUT_PATH}`);
}

main();

/**
 * classic-monster.schema.ts
 *
 * Zod schema and TypeScript type for a fully-normalized ClassicMonster entry,
 * as stored in data/generated/classic-monsters.json.
 */

import { z } from "zod";

export const ClassicMonsterSchema = z.object({
  /** Unique internal ID (string slug-based) */
  id: z.string(),
  /** com2us internal ID – pivot key for all source merges */
  com2usId: z.number().int(),
  /** URL-friendly slug (from Lucksack) */
  slug: z.string(),
  /** Full display name, e.g. "Fire Ifrit" */
  displayName: z.string(),
  /** Short name / nickname, e.g. "Veromos" */
  shortName: z.string(),
  /** Family name derived from family_id, or null if unavailable */
  familyName: z.string().nullable(),
  /** Element (e.g. "fire", "water", "wind", "light", "dark") */
  element: z.string(),
  /** Monster archetype / role */
  archetype: z.string().nullable(),
  /** Natural star rating 1–6 */
  naturalStars: z.number().int().nullable(),
  /** Awaken level: 0 = base, 1 = awakened, 2 = second awakened */
  awakenLevel: z.number().int().nullable(),
  /** Whether the monster is obtainable in-game */
  obtainable: z.boolean().nullable(),
  /** Whether it is used as fusion food */
  fusionFood: z.boolean().nullable(),
  /** Total number of skill-ups needed to max the monster */
  skillUpsToMax: z.number().int().nullable(),
  /** True when leader_skill is not null in SWARFARM */
  hasLeaderSkill: z.boolean().nullable(),
  /** True when at least one linked skill has passive=true */
  hasPassive: z.boolean().nullable(),
  /** Base speed */
  speed: z.number().int().nullable(),
  /** Base HP */
  baseHp: z.number().int().nullable(),
  /** Base Attack */
  baseAttack: z.number().int().nullable(),
  /** Base Defense */
  baseDefense: z.number().int().nullable(),
  /** Base Critical Rate (%) */
  critRate: z.number().nullable(),
  /** Base Critical Damage (%) */
  critDamage: z.number().nullable(),
  /** Base Resistance (%) */
  resistance: z.number().nullable(),
  /** Base Accuracy (%) */
  accuracy: z.number().nullable(),
  /** Image URL or path */
  image: z.string(),
  /** Whether this monster appears in search suggestions */
  searchable: z.boolean(),
  /** Pre-computed search tokens for fast lookup */
  searchTokens: z.array(z.string()),
});

export type ClassicMonster = z.infer<typeof ClassicMonsterSchema>;

export const ClassicMonsterDatasetSchema = z.array(ClassicMonsterSchema);
export type ClassicMonsterDataset = z.infer<typeof ClassicMonsterDatasetSchema>;

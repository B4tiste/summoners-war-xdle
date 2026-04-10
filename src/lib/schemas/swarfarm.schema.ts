/**
 * swarfarm.schema.ts
 *
 * Zod schema for a single entry from the SWARFARM/BP-data monsters bestiary.
 * Source: https://raw.githubusercontent.com/B4tiste/BP-data/refs/heads/main/data/monsters_elements.json
 *
 * The file has the shape: { "monsters": [...] }
 * Stats are flat fields on each monster (not nested).
 */

import { z } from "zod";

export const SwarfarmMonsterEntrySchema = z.object({
  /** com2us internal ID (primary key for merging) */
  com2us_id: z.number().int(),
  /** SWARFARM bestiary URL slug */
  bestiary_slug: z.string().nullable().optional(),
  /** Monster family identifier */
  family_id: z.number().int().nullable().optional(),
  /** Natural star rating (1-6) */
  natural_stars: z.number().int().nullable().optional(),
  /** Awaken level (0 = base, 1 = awakened, 2 = second awakened) */
  awaken_level: z.number().int().nullable().optional(),
  /** Monster archetype / role */
  archetype: z.string().nullable().optional(),
  /** Whether the monster can be obtained */
  obtainable: z.boolean().nullable().optional(),
  /** Whether it is used as fusion food */
  fusion_food: z.boolean().nullable().optional(),
  /** Total number of skill-ups to max all skills */
  skill_ups_to_max: z.number().int().nullable().optional(),
  /** Leader skill object (null when the monster has no leader skill) */
  leader_skill: z.unknown().nullable().optional(),
  /** Skill IDs attached to this monster */
  skills: z.array(z.number().int()).optional(),

  // Flat base stats (directly on the monster object)
  speed: z.number().int().nullable().optional(),
  base_hp: z.number().int().nullable().optional(),
  base_attack: z.number().int().nullable().optional(),
  base_defense: z.number().int().nullable().optional(),
  crit_rate: z.number().nullable().optional(),
  crit_damage: z.number().nullable().optional(),
  resistance: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
}).passthrough(); // Allow extra fields without failing validation

export type SwarfarmMonsterEntry = z.infer<typeof SwarfarmMonsterEntrySchema>;

/**
 * The monsters_elements.json file is an object with a "monsters" array.
 */
export const SwarfarmBestiaryFileSchema = z.object({
  monsters: z.array(SwarfarmMonsterEntrySchema),
}).passthrough();

export type SwarfarmBestiaryFile = z.infer<typeof SwarfarmBestiaryFileSchema>;

/** Convenience alias for just the monsters array */
export const SwarfarmBestiarySchema = z.array(SwarfarmMonsterEntrySchema);
export type SwarfarmBestiary = z.infer<typeof SwarfarmBestiarySchema>;

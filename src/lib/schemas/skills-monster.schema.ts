/**
 * skills-monster.schema.ts
 *
 * Zod schema and TypeScript type for a SkillsMonster entry,
 * as stored in data/generated/skills-monsters.json.
 */

import { z } from "zod";

export const SkillEntrySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  iconFilename: z.string(),
});

export type SkillEntry = z.infer<typeof SkillEntrySchema>;

export const SkillsMonsterSchema = z.object({
  com2usId: z.number().int(),
  slug: z.string(),
  displayName: z.string(),
  image: z.string(),
  element: z.string(),
  skills: z.array(SkillEntrySchema),
});

export type SkillsMonster = z.infer<typeof SkillsMonsterSchema>;

export const SkillsMonsterDatasetSchema = z.array(SkillsMonsterSchema);

/**
 * lucksack.schema.ts
 *
 * Zod schema for a single entry from the Lucksack monsters catalog.
 * Source: https://static.lucksack.gg/data/monsters_catalog.json
 */

import { z } from "zod";

/** Base URL for monster images served by SWARFARM */
export const MONSTER_IMAGE_BASE_URL =
  "https://swarfarm.com/static/herders/images/monsters/";

export const LucksackCatalogEntrySchema = z.object({
  /**
   * com2us internal monster ID as a string in the JSON.
   * Parse to number with parseInt() when needed.
   */
  com2us_id: z.string(),
  /** Display label (e.g. "Fire Ifrit") */
  label: z.string(),
  /** Short label / nickname (e.g. "Veromos") */
  slabel: z.string(),
  /** URL-friendly identifier */
  slug: z.string(),
  /** Image filename (e.g. "unit_icon_0001_0_0.png") — prepend MONSTER_IMAGE_BASE_URL */
  image: z.string(),
  /** Whether this monster is included in guessing/search */
  searchable: z.boolean(),
  /** Element name (e.g. "Fire", "Water") */
  element: z.string(),
  /** Collab variant com2us_id if the monster has a collab skin */
  collab_id: z.string().nullable().optional(),
  /** Collab skin image filename */
  collab_image: z.string().nullable().optional(),
});

export type LucksackCatalogEntry = z.infer<typeof LucksackCatalogEntrySchema>;

/** The catalog file is an array of entries */
export const LucksackCatalogSchema = z.array(LucksackCatalogEntrySchema);
export type LucksackCatalog = z.infer<typeof LucksackCatalogSchema>;

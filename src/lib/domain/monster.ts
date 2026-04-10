/**
 * monster.ts
 *
 * Core domain model for a raw merged monster entry, bridging the Lucksack
 * catalog and the SWARFARM bestiary before final normalization.
 */

import type { LucksackCatalogEntry } from "@/lib/schemas/lucksack.schema";
import { MONSTER_IMAGE_BASE_URL } from "@/lib/schemas/lucksack.schema";
import type { SwarfarmMonsterEntry } from "@/lib/schemas/swarfarm.schema";

/**
 * Intermediate merged representation combining both raw data sources.
 * All SWARFARM fields are optional because a monster might exist only in
 * the Lucksack catalog (or vice versa).
 */
export interface RawMergedMonster {
  com2usId: number;

  // -- From Lucksack --
  label: string;
  slabel: string;
  slug: string;
  image: string;
  searchable: boolean;
  element: string;

  // -- From SWARFARM (all nullable) --
  bestiarySlug: string | null;
  familyId: number | null;
  naturalStars: number | null;
  awakenLevel: number | null;
  archetype: string | null;
  obtainable: boolean | null;
  fusionFood: boolean | null;
  skillUpsToMax: number | null;
  hasLeaderSkill: boolean | null;
  skillIds: number[];

  // -- Base stats (all nullable) --
  speed: number | null;
  baseHp: number | null;
  baseAttack: number | null;
  baseDefense: number | null;
  critRate: number | null;
  critDamage: number | null;
  resistance: number | null;
  accuracy: number | null;
}

/**
 * Merges a Lucksack entry with an optional SWARFARM entry into the
 * intermediate RawMergedMonster representation.
 *
 * Note: SWARFARM (monsters_elements.json) exposes stats as flat fields
 * directly on the monster object (speed, base_hp, base_attack, base_defense,
 * crit_rate, crit_damage, resistance, accuracy).
 */
export function mergeMonsterSources(
  lucksack: LucksackCatalogEntry,
  swarfarm: SwarfarmMonsterEntry | null
): RawMergedMonster {
  const com2usId = parseInt(lucksack.com2us_id, 10);
  const imageUrl = `${MONSTER_IMAGE_BASE_URL}${lucksack.image}`;

  return {
    com2usId,
    label: lucksack.label,
    slabel: lucksack.slabel,
    slug: lucksack.slug,
    image: imageUrl,
    searchable: lucksack.searchable,
    element: lucksack.element,

    bestiarySlug: swarfarm?.bestiary_slug ?? null,
    familyId: swarfarm?.family_id ?? null,
    naturalStars: swarfarm?.natural_stars ?? null,
    awakenLevel: swarfarm?.awaken_level ?? null,
    archetype: swarfarm?.archetype ?? null,
    obtainable: swarfarm?.obtainable ?? null,
    fusionFood: swarfarm?.fusion_food ?? null,
    skillUpsToMax: swarfarm?.skill_ups_to_max ?? null,
    hasLeaderSkill:
      swarfarm == null ? null : swarfarm.leader_skill != null,
    skillIds: swarfarm?.skills ?? [],

    // Flat stats on SWARFARM entry
    speed: swarfarm?.speed ?? null,
    baseHp: swarfarm?.base_hp ?? null,
    baseAttack: swarfarm?.base_attack ?? null,
    baseDefense: swarfarm?.base_defense ?? null,
    critRate: swarfarm?.crit_rate ?? null,
    critDamage: swarfarm?.crit_damage ?? null,
    resistance: swarfarm?.resistance ?? null,
    accuracy: swarfarm?.accuracy ?? null,
  };
}

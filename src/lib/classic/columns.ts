/**
 * columns.ts
 *
 * Config-driven column definitions for the Classic game mode.
 * Each column declares how it should be displayed and what type of
 * comparator to apply.
 */

import type { ClassicColumnKey } from "./types";
import type { ClassicMonster } from "@/lib/schemas/classic-monster.schema";

/** Supported column data types that determine comparator logic */
export type ColumnType = "enum" | "number" | "bool";

export interface ColumnDefinition {
  key: ClassicColumnKey;
  /** Human-readable label shown in the grid header */
  label: string;
  /** How to compare values for this column */
  type: ColumnType;
  /** Extracts the raw value from a ClassicMonster */
  getValue: (monster: ClassicMonster) => string | number | boolean | null;
}

/**
 * Ordered list of columns displayed in the Classic guess grid.
 * Add / remove / reorder entries here to update the entire game.
 */
export const CLASSIC_COLUMNS: ColumnDefinition[] = [
  {
    key: "element",
    label: "Element",
    type: "enum",
    getValue: (m) => m.element,
  },
  {
    key: "archetype",
    label: "Archetype",
    type: "enum",
    getValue: (m) => m.archetype,
  },
  {
    key: "naturalStars",
    label: "Natural Stars",
    type: "number",
    getValue: (m) => m.naturalStars,
  },
  {
    key: "skillUpsToMax",
    label: "Skill Ups To Max",
    type: "number",
    getValue: (m) => m.skillUpsToMax,
  },
  {
    key: "hasLeaderSkill",
    label: "Has a leader skill ?",
    type: "bool",
    getValue: (m) => m.hasLeaderSkill,
  },
  {
    key: "speed",
    label: "Speed",
    type: "number",
    getValue: (m) => m.speed,
  },
  {
    key: "hasPassive",
    label: "Has a passive",
    type: "bool",
    getValue: (m) => m.hasPassive,
  },
];

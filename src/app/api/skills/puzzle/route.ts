/**
 * GET /api/skills/puzzle
 *
 * Returns puzzle skill icons for Skills mode.
 * - daily: 3 deterministic targets for the day
 * - free: 3 targets provided via query param
 */

import type { NextRequest } from "next/server";
import {
  findSkillsMonsterById,
  getDailySkillsTargets,
  todayFranceSkills,
} from "@/lib/datasets/load-skills-dataset";

const TARGETS_PER_ROUND = 3;

function skillToDto(skill: { id: number; name: string; iconFilename: string }) {
  return {
    id: skill.id,
    name: skill.name,
    iconUrl: `https://swarfarm.com/static/herders/images/skills/${skill.iconFilename}`,
  };
}

function pickClueSkill(monster: { skills: Array<{ id: number; name: string; iconFilename: string }> }, seed: number) {
  const index = seed % monster.skills.length;
  return monster.skills[index];
}

export function GET(request: NextRequest) {
  try {
    const modeParam = request.nextUrl.searchParams.get("mode");
    const mode = modeParam === "free" ? "free" : "daily";
    const targetCom2usIds = request.nextUrl.searchParams.get("targetCom2usIds");

    const date = todayFranceSkills();
    const targets =
      mode === "free"
        ? (() => {
            if (!targetCom2usIds) {
              throw new Error("Missing targetCom2usIds for free mode.");
            }

            const ids = targetCom2usIds
              .split(",")
              .map((raw) => Number(raw.trim()))
              .filter((id) => Number.isInteger(id));

            if (ids.length !== TARGETS_PER_ROUND) {
              throw new Error(`Expected ${TARGETS_PER_ROUND} target IDs for free mode.`);
            }

            const uniqueIds = Array.from(new Set(ids));
            if (uniqueIds.length !== TARGETS_PER_ROUND) {
              throw new Error("Duplicate target IDs are not allowed.");
            }

            const freeTargets = uniqueIds.map((id) => {
              const freeTarget = findSkillsMonsterById(id);
              if (!freeTarget) {
                throw new Error(`Free target com2usId=${id} not found.`);
              }
              return freeTarget;
            });

            return freeTargets;
          })()
        : getDailySkillsTargets(date, TARGETS_PER_ROUND);

    const clues = targets.map((target, index) => {
      const skill = pickClueSkill(target, date.charCodeAt(index % date.length) + index * 17);
      return {
        slotId: index + 1,
        skill: skillToDto(skill),
      };
    });

    return Response.json({ date, mode, clues, totalTargets: TARGETS_PER_ROUND });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

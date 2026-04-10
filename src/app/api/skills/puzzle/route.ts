/**
 * GET /api/skills/puzzle
 *
 * Returns puzzle skill icons for Skills mode.
 * - daily: today's target
 * - free: target provided via query param
 */

import type { NextRequest } from "next/server";
import {
  findSkillsMonsterById,
  getDailySkillsTarget,
  todayFranceSkills,
} from "@/lib/datasets/load-skills-dataset";

export function GET(request: NextRequest) {
  try {
    const modeParam = request.nextUrl.searchParams.get("mode");
    const mode = modeParam === "free" ? "free" : "daily";
    const targetCom2usId = request.nextUrl.searchParams.get("targetCom2usId");

    const date = todayFranceSkills();
    const target =
      mode === "free"
        ? (() => {
            const parsedId = Number(targetCom2usId);
            if (!Number.isInteger(parsedId)) {
              throw new Error("Missing or invalid targetCom2usId for free mode.");
            }

            const freeTarget = findSkillsMonsterById(parsedId);
            if (!freeTarget) {
              throw new Error(`Free target com2usId=${parsedId} not found.`);
            }

            return freeTarget;
          })()
        : getDailySkillsTarget(date);

    const skills = target.skills.map((s) => ({
      id: s.id,
      name: s.name,
      iconUrl: `https://swarfarm.com/static/herders/images/skills/${s.iconFilename}`,
    }));

    return Response.json({ date, mode, skills });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

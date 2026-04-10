/**
 * POST /api/skills/guess
 *
 * Accepts a monster slug guess for Skills mode.
 * One round has 3 targets. A guess can match one of them.
 * Win condition: all 3 targets found.
 *
 * Request body:
 * { slug: string, mode?: "daily" | "free", targetCom2usIds?: number[], foundSlugs?: string[] }
 */

import { z } from "zod";
import type { NextRequest } from "next/server";
import {
  findSkillsMonsterById,
  getDailySkillsTargets,
  todayFranceSkills,
} from "@/lib/datasets/load-skills-dataset";
import { loadClassicDataset } from "@/lib/datasets/load-classic-dataset";

const TARGETS_PER_ROUND = 3;

const GuessBodySchema = z.object({
  slug: z.string().min(1),
  mode: z.enum(["daily", "free"]).optional(),
  targetCom2usIds: z.array(z.number().int()).optional(),
  foundSlugs: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = GuessBodySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body", details: parsed.error.message },
        { status: 400 }
      );
    }

    const { slug, mode = "daily", targetCom2usIds, foundSlugs = [] } = parsed.data;

    // Validate the guessed monster exists in the classic dataset (searchable monsters)
    const classicDataset = loadClassicDataset();
    const guessMonster = classicDataset.find((m) => m.slug === slug);
    if (!guessMonster) {
      return Response.json(
        { error: `Monster with slug "${slug}" not found.` },
        { status: 404 }
      );
    }

    if (mode === "free" && (!targetCom2usIds || targetCom2usIds.length !== TARGETS_PER_ROUND)) {
      return Response.json(
        { error: `Missing targetCom2usIds for free mode (expected ${TARGETS_PER_ROUND}).` },
        { status: 400 }
      );
    }

    const date = todayFranceSkills();
    const targets =
      mode === "free"
        ? targetCom2usIds!.map((id) => {
            const target = findSkillsMonsterById(id);
            if (!target) {
              throw new Error(`Free target com2usId=${id} not found.`);
            }
            return target;
          })
        : getDailySkillsTargets(date, TARGETS_PER_ROUND);

    const matchedIndex = targets.findIndex((target) => target.slug === slug);
    const matchedTarget = matchedIndex >= 0 ? targets[matchedIndex] : undefined;
    const alreadyFound = foundSlugs.includes(slug);

    if (!matchedTarget || alreadyFound) {
      return Response.json({
        isMatch: false,
        isWin: foundSlugs.length >= TARGETS_PER_ROUND,
        solvedCount: foundSlugs.length,
        totalTargets: TARGETS_PER_ROUND,
      });
    }

    const nextSolvedCount = foundSlugs.length + 1;
    return Response.json({
      isMatch: true,
      isWin: nextSolvedCount >= TARGETS_PER_ROUND,
      solvedCount: nextSolvedCount,
      totalTargets: TARGETS_PER_ROUND,
      matchedSlotId: matchedIndex + 1,
      matchedTarget: {
        com2usId: matchedTarget.com2usId,
        slug: matchedTarget.slug,
        displayName: matchedTarget.displayName,
        image: matchedTarget.image,
        element: matchedTarget.element,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

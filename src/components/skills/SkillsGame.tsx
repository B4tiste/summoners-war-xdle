"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MonsterSearchInput, type MonsterSuggestion } from "@/components/classic/MonsterSearchInput";

const SKILLS_DAILY_STORAGE_KEY = "swdle:skills-progress:v2";
const TARGETS_PER_ROUND = 3;

type PlayMode = "daily" | "free";

function pickRandomRotation(): 90 | 180 | 270 {
  const values: Array<90 | 180 | 270> = [90, 180, 270];
  return values[Math.floor(Math.random() * values.length)];
}

function getDateInTimeZone(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return new Date().toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function getTimeUntilNextParisMidnightMs(): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const second = Number(parts.find((p) => p.type === "second")?.value ?? "0");
  const elapsedMs = ((hour * 60 + minute) * 60 + second) * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, dayMs - elapsedMs);
}

function formatDurationHhMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

interface SkillInfo {
  id: number;
  name: string;
  iconUrl: string;
}

interface Clue {
  slotId: number;
  skill: SkillInfo;
}

interface FoundTargetSummary {
  com2usId: number;
  slug: string;
  displayName: string;
  image: string;
  element: string;
}

interface FoundTarget {
  slotId: number;
  target: FoundTargetSummary;
}

interface DailyProgressSnapshot {
  date: string;
  guesses: string[];
  guessDisplayNames: string[];
  foundTargets: FoundTarget[];
}

interface FreeTargetsResponse {
  targetCom2usIds: number[];
  error?: string;
}

interface PuzzleResponse {
  date?: string;
  mode?: PlayMode;
  clues?: Clue[];
  totalTargets?: number;
  error?: string;
}

interface GuessResponse {
  isMatch: boolean;
  isWin: boolean;
  solvedCount: number;
  totalTargets: number;
  matchedSlotId?: number;
  matchedTarget?: FoundTargetSummary;
  error?: string;
}

export function SkillsGame() {
  const [selectedMode, setSelectedMode] = useState<PlayMode>("daily");
  const [date, setDate] = useState<string | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [freeTargetCom2usIds, setFreeTargetCom2usIds] = useState<number[] | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [guessDisplayNames, setGuessDisplayNames] = useState<string[]>([]);
  const [foundTargets, setFoundTargets] = useState<FoundTarget[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPuzzle, setLoadingPuzzle] = useState(true);
  const [loadingFreeTargets, setLoadingFreeTargets] = useState(false);
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState("00:00:00");

  const restoredDailyDateRef = useRef<string | null>(null);
  const currentDateRef = useRef<string | null>(null);

  const isWin = foundTargets.length >= TARGETS_PER_ROUND;

  const foundBySlot = useMemo(() => {
    return new Map(foundTargets.map((entry) => [entry.slotId, entry.target]));
  }, [foundTargets]);

  const foundSlugs = useMemo(() => foundTargets.map((entry) => entry.target.slug), [foundTargets]);

  const solvedSlugSet = useMemo(() => new Set(foundSlugs), [foundSlugs]);

  const clueRotations = useMemo(() => {
    return clues.map(() => pickRandomRotation());
  }, [clues]);

  const resetRound = useCallback(() => {
    setGuesses([]);
    setGuessDisplayNames([]);
    setFoundTargets([]);
    setError(null);
    setSubmitting(false);
  }, []);

  const loadPuzzle = useCallback(async (mode: PlayMode, targetIds?: number[]) => {
    try {
      setLoadingPuzzle(true);
      setError(null);

      const params = new URLSearchParams({ mode });
      if (mode === "free" && targetIds && targetIds.length > 0) {
        params.set("targetCom2usIds", targetIds.join(","));
      }

      const res = await fetch(`/api/skills/puzzle?${params.toString()}`);
      const data = (await res.json()) as PuzzleResponse;

      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to load puzzle.");
        return;
      }

      setDate(data.date ?? null);
      setClues(data.clues ?? []);
      currentDateRef.current = data.date ?? null;
    } catch {
      setError("Network error while loading puzzle.");
    } finally {
      setLoadingPuzzle(false);
    }
  }, []);

  const fetchFreeTargets = useCallback(async (previousTargetIds?: number[]) => {
    setLoadingFreeTargets(true);

    try {
      const res = await fetch("/api/skills/free-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previousTargetCom2usIds: previousTargetIds ?? [] }),
      });

      const data = (await res.json()) as FreeTargetsResponse;
      if (!res.ok || data.error || !Array.isArray(data.targetCom2usIds)) {
        setError(data.error ?? "Failed to generate a skills free-play round.");
        return null;
      }

      if (data.targetCom2usIds.length !== TARGETS_PER_ROUND) {
        setError(`Expected ${TARGETS_PER_ROUND} free-play targets, got ${data.targetCom2usIds.length}.`);
        return null;
      }

      setFreeTargetCom2usIds(data.targetCom2usIds);
      return data.targetCom2usIds;
    } catch {
      setError("Failed to generate a skills free-play round.");
      return null;
    } finally {
      setLoadingFreeTargets(false);
    }
  }, []);

  useEffect(() => {
    void loadPuzzle("daily");
  }, [loadPuzzle]);

  const switchMode = useCallback(
    async (mode: PlayMode) => {
      if (mode === selectedMode) return;

      setSelectedMode(mode);
      resetRound();

      if (mode === "daily") {
        restoredDailyDateRef.current = null;
        await loadPuzzle("daily");
        return;
      }

      const ids = await fetchFreeTargets(freeTargetCom2usIds ?? undefined);
      if (ids) {
        await loadPuzzle("free", ids);
      }
    },
    [fetchFreeTargets, freeTargetCom2usIds, loadPuzzle, resetRound, selectedMode]
  );

  useEffect(() => {
    if (selectedMode !== "daily" || !date) return;
    if (restoredDailyDateRef.current === date) return;

    restoredDailyDateRef.current = date;
    setGuesses([]);
    setGuessDisplayNames([]);
    setFoundTargets([]);

    try {
      const raw = localStorage.getItem(SKILLS_DAILY_STORAGE_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as DailyProgressSnapshot;
      if (snapshot.date !== date) return;

      setGuesses(snapshot.guesses ?? []);
      setGuessDisplayNames(snapshot.guessDisplayNames ?? []);
      setFoundTargets(snapshot.foundTargets ?? []);
    } catch {
      // Ignore malformed storage
    }
  }, [date, selectedMode]);

  useEffect(() => {
    if (selectedMode !== "daily") return;
    if (!date) return;
    if (restoredDailyDateRef.current !== date) return;

    try {
      const snapshot: DailyProgressSnapshot = {
        date,
        guesses,
        guessDisplayNames,
        foundTargets,
      };
      localStorage.setItem(SKILLS_DAILY_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage errors
    }
  }, [date, foundTargets, guessDisplayNames, guesses, selectedMode]);

  useEffect(() => {
    if (selectedMode !== "daily") return;

    const interval = window.setInterval(() => {
      const franceDate = getDateInTimeZone("Europe/Paris");
      if (currentDateRef.current && franceDate !== currentDateRef.current) {
        window.location.reload();
      }
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [selectedMode]);

  useEffect(() => {
    const update = () => setNextRefreshCountdown(formatDurationHhMmSs(getTimeUntilNextParisMidnightMs()));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleGuess = useCallback(
    async (suggestion: MonsterSuggestion) => {
      if (isWin || submitting) return;

      if (selectedMode === "free" && (!freeTargetCom2usIds || freeTargetCom2usIds.length !== TARGETS_PER_ROUND)) {
        setError("Free-play targets are not ready yet. Please wait a second.");
        return;
      }

      if (guesses.includes(suggestion.slug)) {
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const res = await fetch("/api/skills/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: suggestion.slug,
            mode: selectedMode,
            targetCom2usIds: selectedMode === "free" ? freeTargetCom2usIds ?? undefined : undefined,
            foundSlugs,
          }),
        });

        const data = (await res.json()) as GuessResponse;
        if (!res.ok || data.error) {
          setError(data.error ?? "Guess failed.");
          return;
        }

        setGuesses((prev) => [...prev, suggestion.slug]);
        setGuessDisplayNames((prev) => [...prev, suggestion.displayName]);

        if (data.isMatch && data.matchedTarget && data.matchedSlotId) {
          setFoundTargets((prev) => {
            if (prev.some((entry) => entry.target.slug === data.matchedTarget!.slug)) {
              return prev;
            }
            return [...prev, { slotId: data.matchedSlotId!, target: data.matchedTarget! }];
          });
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [freeTargetCom2usIds, foundSlugs, guesses, isWin, selectedMode, submitting]
  );

  const handleRefreshFreePlay = useCallback(async () => {
    const previous = freeTargetCom2usIds ?? undefined;
    resetRound();

    const ids = await fetchFreeTargets(previous);
    if (ids) {
      await loadPuzzle("free", ids);
    }
  }, [fetchFreeTargets, freeTargetCom2usIds, loadPuzzle, resetRound]);

  if (loadingPuzzle) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-zinc-400">
        Loading today&apos;s skills challenge...
      </div>
    );
  }

  if (error && clues.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-8">
      <div className="flex w-full max-w-xl flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 sm:flex-row sm:items-center sm:justify-center">
        <button
          type="button"
          onClick={() => void switchMode("daily")}
          className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:w-auto ${
            selectedMode === "daily"
              ? "bg-amber-400 text-zinc-950"
              : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          Skills Daily Challenge
        </button>
        <button
          type="button"
          onClick={() => void switchMode("free")}
          className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:w-auto ${
            selectedMode === "free"
              ? "bg-amber-400 text-zinc-950"
              : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          Free Play
        </button>
      </div>

      <div className="flex w-full max-w-xl flex-col items-center gap-1 text-center">
        <h2 className="text-xl font-bold text-amber-400 sm:text-2xl">
          {selectedMode === "daily" ? "Skills Daily Challenge" : "Skills Free Play"}
        </h2>
        <h3 className="px-2 text-xs text-zinc-300 sm:text-sm">By B4tiste with the help of Layn</h3>
        <p className="text-xs text-zinc-400">
          Three random spells from three different monsters are shown. Find all three monsters.
        </p>
      </div>

      {selectedMode === "free" && (
        <button
          type="button"
          onClick={() => void handleRefreshFreePlay()}
          disabled={loadingFreeTargets || submitting}
          className="w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingFreeTargets ? "Generating round..." : "Refresh free-play round"}
        </button>
      )}

      <div className="grid w-full max-w-xl grid-cols-3 gap-3 sm:gap-4">
        {clues.map((clue) => {
          const found = foundBySlot.get(clue.slotId);
          return (
            <div key={clue.slotId} className="flex flex-col items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Spell {clue.slotId}</div>
              <div className={["h-14 w-14 overflow-hidden rounded-lg border-2 sm:h-16 sm:w-16", found ? "border-amber-400" : "border-zinc-600"].join(" ")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clue.skill.iconUrl}
                  alt={`Spell ${clue.slotId}`}
                  className={["h-full w-full object-cover transition-transform duration-700", found ? "grayscale-0" : "grayscale"].join(" ")}
                  style={{ transform: `rotate(${found ? 0 : (clueRotations[clue.slotId - 1] ?? 90)}deg)` }}
                />
              </div>
              {found ? (
                <div className="text-[10px] text-emerald-300">{found.displayName}</div>
              ) : (
                <div className="text-[10px] text-zinc-500">Monster not found yet</div>
              )}
            </div>
          );
        })}
      </div>

      {isWin && (
        <div className="w-full max-w-xl rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-center">
          <p className="text-sm text-amber-400">All {TARGETS_PER_ROUND} monsters found.</p>
          <p className="text-xs text-zinc-300">
            Solved in {guesses.length} guess{guesses.length > 1 ? "es" : ""}.
          </p>
          {selectedMode === "daily" && (
            <p className="text-xs text-zinc-400">Next Skills challenge in {nextRefreshCountdown}</p>
          )}
          {selectedMode === "free" && (
            <p className="text-xs text-zinc-400">Refresh free play to start a new round.</p>
          )}
        </div>
      )}

      {!isWin && selectedMode === "daily" && (
        <p className="text-xs text-zinc-500">Next monster refresh in {nextRefreshCountdown}</p>
      )}

      {guesses.length > 0 && (
        <div className="w-full max-w-xl">
          <p className="mb-2 text-center text-xs text-zinc-400">
            {guesses.length} guess{guesses.length > 1 ? "es" : ""}:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {guessDisplayNames.map((name, i) => {
              const slug = guesses[i];
              const isSolved = solvedSlugSet.has(slug);
              return (
                <span
                  key={`${slug}-${i}`}
                  className={[
                    "rounded-full px-3 py-1 text-xs",
                    isSolved
                      ? "bg-emerald-700/60 text-emerald-200"
                      : "bg-zinc-700/60 text-zinc-300 line-through",
                  ].join(" ")}
                >
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {!isWin && (
        <div className="w-full max-w-xl">
          <MonsterSearchInput
            onSelect={handleGuess}
            disabled={submitting || isWin}
            excludeSlugs={guesses}
            placeholder="Type a monster name..."
          />
        </div>
      )}
    </div>
  );
}

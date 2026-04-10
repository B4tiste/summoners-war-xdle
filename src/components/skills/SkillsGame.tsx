"use client";

/**
 * SkillsGame
 *
 * Daily Skills mode: guess the monster from its skill icons.
 * Skill icons start rotated. Every 5 failed attempts,
 * one more icon is fixed from left to right.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MonsterSearchInput, type MonsterSuggestion } from "@/components/classic/MonsterSearchInput";

const SKILLS_DAILY_STORAGE_KEY = "swdle:skills-progress:v1";
type PlayMode = "daily" | "free";

/* -------------------- helpers -------------------- */

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

function pickRandomRotation(): 90 | 180 | 270 {
  const rotations: Array<90 | 180 | 270> = [90, 180, 270];
  return rotations[Math.floor(Math.random() * rotations.length)];
}

/* -------------------- types -------------------- */

interface SkillInfo {
  id: number;
  name: string;
  iconUrl: string;
}

interface TargetSummary {
  com2usId: number;
  slug: string;
  displayName: string;
  image: string;
  element: string;
  skills: SkillInfo[];
}

interface DailyProgressSnapshot {
  date: string;
  guesses: string[]; // slugs of guessed monsters (in order)
  guessDisplayNames: string[];
  isWin: boolean;
  targetSummary: TargetSummary | null;
}

interface FreeTargetResponse {
  targetCom2usId: number;
  error?: string;
}

/* -------------------- component -------------------- */

export function SkillsGame() {
  const [selectedMode, setSelectedMode] = useState<PlayMode>("daily");
  const [date, setDate] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [guesses, setGuesses] = useState<string[]>([]); // slugs
  const [guessDisplayNames, setGuessDisplayNames] = useState<string[]>([]);
  const [isWin, setIsWin] = useState(false);
  const [targetSummary, setTargetSummary] = useState<TargetSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPuzzle, setLoadingPuzzle] = useState(true);
  const [freeTargetCom2usId, setFreeTargetCom2usId] = useState<number | null>(null);
  const [loadingFreeTarget, setLoadingFreeTarget] = useState(false);
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState("00:00:00");

  const restoredDailyDateRef = useRef<string | null>(null);
  const currentDateRef = useRef<string | null>(null);

  const resetRound = useCallback(() => {
    setGuesses([]);
    setGuessDisplayNames([]);
    setIsWin(false);
    setTargetSummary(null);
    setError(null);
    setSubmitting(false);
  }, []);

  const loadPuzzle = useCallback(async (mode: PlayMode, targetCom2usId?: number) => {
    try {
      setLoadingPuzzle(true);
      setError(null);

      const params = new URLSearchParams({ mode });
      if (mode === "free" && targetCom2usId != null) {
        params.set("targetCom2usId", String(targetCom2usId));
      }

      const res = await fetch(`/api/skills/puzzle?${params.toString()}`);
      const data = (await res.json()) as {
        date?: string;
        mode?: PlayMode;
        skills?: SkillInfo[];
        error?: string;
      };

      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to load puzzle.");
        return;
      }

      setDate(data.date ?? null);
      setSkills(data.skills ?? []);
      currentDateRef.current = data.date ?? null;
    } catch {
      setError("Network error while loading puzzle.");
    } finally {
      setLoadingPuzzle(false);
    }
  }, []);

  const fetchFreeTarget = useCallback(async (previousTargetCom2usId?: number) => {
    setLoadingFreeTarget(true);

    try {
      const res = await fetch("/api/skills/free-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previousTargetCom2usId }),
      });

      const data = (await res.json()) as FreeTargetResponse;
      if (!res.ok || data.error || data.targetCom2usId == null) {
        setError(data.error ?? "Failed to generate a skills free-play target.");
        return null;
      }

      setFreeTargetCom2usId(data.targetCom2usId);
      return data.targetCom2usId;
    } catch {
      setError("Failed to generate a skills free-play target.");
      return null;
    } finally {
      setLoadingFreeTarget(false);
    }
  }, []);

  /* ---- Load puzzle on mount ---- */
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

      const nextTarget = await fetchFreeTarget(freeTargetCom2usId ?? undefined);
      if (nextTarget != null) {
        await loadPuzzle("free", nextTarget);
      }
    },
    [fetchFreeTarget, freeTargetCom2usId, loadPuzzle, resetRound, selectedMode]
  );

  /* ---- Restore daily progress from localStorage ---- */
  useEffect(() => {
    if (selectedMode !== "daily" || !date) return;
    if (restoredDailyDateRef.current === date) return;

    restoredDailyDateRef.current = date;

    setGuesses([]);
    setGuessDisplayNames([]);
    setIsWin(false);
    setTargetSummary(null);

    try {
      const raw = localStorage.getItem(SKILLS_DAILY_STORAGE_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as DailyProgressSnapshot;
      if (snapshot.date !== date) return; // stale

      setGuesses(snapshot.guesses);
      setGuessDisplayNames(snapshot.guessDisplayNames);
      setIsWin(snapshot.isWin);
      setTargetSummary(snapshot.targetSummary);
    } catch {
      // Ignore malformed data
    }
  }, [date, selectedMode]);

  /* ---- Save daily progress to localStorage ---- */
  useEffect(() => {
    if (selectedMode !== "daily") return;
    if (!date) return;
    if (restoredDailyDateRef.current !== date) return;

    try {
      const snapshot: DailyProgressSnapshot = {
        date,
        guesses,
        guessDisplayNames,
        isWin,
        targetSummary,
      };
      localStorage.setItem(SKILLS_DAILY_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage errors
    }
  }, [date, guessDisplayNames, guesses, isWin, selectedMode, targetSummary]);

  /* ---- Auto-reload when France date changes ---- */
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

  /* ---- Countdown timer ---- */
  useEffect(() => {
    function update() {
      setNextRefreshCountdown(formatDurationHhMmSs(getTimeUntilNextParisMidnightMs()));
    }
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  /* ---- Submit a guess ---- */
  const handleGuess = useCallback(
    async (suggestion: MonsterSuggestion) => {
      if (isWin || submitting) return;

      if (selectedMode === "free" && freeTargetCom2usId == null) {
        setError("Free-play target is not ready yet. Please wait a second.");
        return;
      }

      // Prevent duplicate guesses
      if (guesses.includes(suggestion.slug)) return;

      setSubmitting(true);
      setError(null);

      try {
        const res = await fetch("/api/skills/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: suggestion.slug,
            mode: selectedMode,
            targetCom2usId: selectedMode === "free" ? freeTargetCom2usId ?? undefined : undefined,
          }),
        });

        const data = (await res.json()) as {
          isWin: boolean;
          targetSummary?: TargetSummary;
          error?: string;
        };

        if (!res.ok || data.error) {
          setError(data.error ?? "Guess failed.");
          return;
        }

        setGuesses((prev) => [...prev, suggestion.slug]);
        setGuessDisplayNames((prev) => [...prev, suggestion.displayName]);

        if (data.isWin) {
          setIsWin(true);
          setTargetSummary(data.targetSummary ?? null);
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [freeTargetCom2usId, guesses, isWin, selectedMode, submitting]
  );

  const handleRefreshFreePlay = useCallback(async () => {
    const previousTarget = freeTargetCom2usId ?? undefined;
    resetRound();

    const nextTarget = await fetchFreeTarget(previousTarget);
    if (nextTarget != null) {
      await loadPuzzle("free", nextTarget);
    }
  }, [fetchFreeTarget, freeTargetCom2usId, loadPuzzle, resetRound]);

  const initialRotations = useMemo(() => {
    return skills.map(() => pickRandomRotation());
  }, [skills]);

  /* ---- Derived: how many icons are fixed ---- */
  // Every 5 failed attempts fixes one icon from left to right.
  // If won, all icons are fixed.
  const failedAttempts = isWin ? guesses.length - 1 : guesses.length;
  const fixedCount = isWin ? skills.length : Math.min(Math.floor(failedAttempts / 5), skills.length);

  /* ---- Render ---- */
  if (loadingPuzzle) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-zinc-400">
        Loading today&apos;s skills challenge…
      </div>
    );
  }

  if (error && skills.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-8">
      {/* Mode menu */}
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

      {/* Header */}
      <div className="flex w-full max-w-xl flex-col items-center gap-1 text-center">
        <h2 className="text-xl font-bold text-amber-400 sm:text-2xl">
          {selectedMode === "daily" ? "Skills Daily Challenge" : "Skills Free Play"}
        </h2>
        <h3 className="px-2 text-xs text-zinc-300 sm:text-sm">By B4tiste with the help of Layn</h3>
        <p className="text-xs text-zinc-400">
          Guess the monster from its skill icons. Icons are randomly rotated, and every 5 failed attempts fixes one icon.
        </p>
      </div>

      {selectedMode === "free" && (
        <button
          type="button"
          onClick={() => void handleRefreshFreePlay()}
          disabled={loadingFreeTarget || submitting}
          className="w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingFreeTarget ? "Generating target..." : "Refresh free-play monster"}
        </button>
      )}

      {/* Skill icons grid */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {skills.map((skill, index) => {
          const isFixed = index < fixedCount;
          const rotation = isFixed ? 0 : (initialRotations[index] ?? 90);
          return (
            <div key={skill.id} className="flex flex-col items-center gap-1">
              <div
                className={[
                  "relative h-14 w-14 overflow-hidden rounded-xl border-2 sm:h-16 sm:w-16",
                  isFixed ? "border-amber-400" : "border-zinc-600",
                  "transition-all duration-700",
                ].join(" ")}
                title={isFixed ? skill.name : "???"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={skill.iconUrl}
                  alt={isFixed ? skill.name : "???"}
                  className={[
                    "h-full w-full object-cover",
                    isWin ? "grayscale-0" : "grayscale",
                    "transition-transform duration-700",
                  ].join(" ")}
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
              </div>
              {isFixed && (
                <span className="max-w-[64px] text-center text-[10px] leading-tight text-zinc-300 sm:max-w-[72px]">
                  {skill.name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Win state */}
      {isWin && targetSummary && (
        <div className="flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-center sm:flex-row sm:gap-4 sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={targetSummary.image}
            alt={targetSummary.displayName}
            className="h-16 w-16 shrink-0 rounded-full border-2 border-amber-400"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm text-amber-400">
              🎉 {targetSummary.displayName}
            </p>
            <p className="text-xs text-zinc-300">
              Found in {guesses.length} guess{guesses.length > 1 ? "es" : ""}!
            </p>
            {selectedMode === "daily" && (
              <p className="text-xs text-zinc-400">
                Next Skills challenge in {nextRefreshCountdown}
              </p>
            )}
            {selectedMode === "free" && (
              <p className="text-xs text-zinc-400">
                Refresh free play to start a new round.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Countdown (not won) */}
      {!isWin && selectedMode === "daily" && (
        <p className="text-xs text-zinc-500">
          Next monster refresh in {nextRefreshCountdown}
        </p>
      )}

      {/* Guess history */}
      {guesses.length > 0 && (
        <div className="w-full max-w-xl">
          <p className="mb-2 text-center text-xs text-zinc-400">
            {guesses.length} guess{guesses.length > 1 ? "es" : ""}:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {guessDisplayNames.map((name, i) => {
              const isLastAndWin = isWin && i === guesses.length - 1;
              return (
                <span
                  key={guesses[i]}
                  className={[
                    "rounded-full px-3 py-1 text-xs",
                    isLastAndWin
                      ? "bg-green-700/60 text-green-200"
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

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Search input */}
      {!isWin && (
        <div className="w-full max-w-xl">
          <MonsterSearchInput
            onSelect={handleGuess}
            disabled={submitting || isWin}
            excludeSlugs={guesses}
            placeholder={selectedMode === "daily" ? "Type a monster name…" : "Type a monster name for free play…"}
          />
        </div>
      )}
    </div>
  );
}

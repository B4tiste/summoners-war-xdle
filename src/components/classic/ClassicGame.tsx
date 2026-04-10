"use client";

/**
 * ClassicGame
 *
 * Main client component orchestrating the Classic mode game loop:
 *  - Loads puzzle metadata on mount
 *  - Accepts search-based monster guesses
 *  - Displays the per-column comparison grid
 *  - Handles win / max-attempts states
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { MonsterSearchInput, type MonsterSuggestion } from "./MonsterSearchInput";
import {
  GuessGrid,
  CELL_REVEAL_DURATION_MS,
  CELL_REVEAL_STAGGER_MS,
} from "./GuessGrid";
import type { GuessResult, TargetSummary } from "@/lib/classic/types";

type PlayMode = "daily" | "free" | "infernokult";

const MODE_PROGRESS_STORAGE_KEYS: Record<"daily" | "infernokult", string> = {
  daily: "swdle:daily-progress:v1",
  infernokult: "swdle:infernokult-progress:v1",
};

function isDateBasedMode(mode: PlayMode): mode is "daily" | "infernokult" {
  return mode !== "free";
}

function getModeTitle(mode: PlayMode): string {
  if (mode === "daily") return "Classic Daily Challenge";
  if (mode === "infernokult") return "Infernokult";
  return "Classic Free Play";
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

interface DailyProgressSnapshot {
  date: string;
  guesses: GuessResult[];
  isWin: boolean;
  targetSummary: TargetSummary | null;
}

interface PuzzleMeta {
  mode: PlayMode;
  date: string;
  columns: { key: string; label: string }[];
  maxAttempts: number;
  previousTargetSummary?: TargetSummary;
}

type ColumnMeta = PuzzleMeta["columns"][number];

interface GuessApiResponse {
  guess: GuessResult["guess"];
  results: GuessResult["results"];
  isWin: boolean;
  targetSummary?: TargetSummary;
  error?: string;
}

interface FreeTargetResponse {
  targetCom2usId: number;
  error?: string;
}

interface FreeSolutionResponse {
  targetSummary?: TargetSummary;
  error?: string;
}

interface ModeProgress {
  puzzleMeta: PuzzleMeta | null;
  freeTargetCom2usId: number | null;
  guesses: GuessResult[];
  isWin: boolean;
  isWinRevealPending: boolean;
  revealingSlug: string | null;
  targetSummary: TargetSummary | null;
  error: string | null;
  submitting: boolean;
  loadingFreeTarget: boolean;
}

function createEmptyModeProgress(): ModeProgress {
  return {
    puzzleMeta: null,
    freeTargetCom2usId: null,
    guesses: [],
    isWin: false,
    isWinRevealPending: false,
    revealingSlug: null,
    targetSummary: null,
    error: null,
    submitting: false,
    loadingFreeTarget: false,
  };
}

export function ClassicGame() {
  const [selectedMode, setSelectedMode] = useState<PlayMode>("daily");
  const [puzzleMeta, setPuzzleMeta] = useState<PuzzleMeta | null>(null);
  const [freeTargetCom2usId, setFreeTargetCom2usId] = useState<number | null>(null);
  const [loadingFreeTarget, setLoadingFreeTarget] = useState(false);
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [isWin, setIsWin] = useState(false);
  const [isWinRevealPending, setIsWinRevealPending] = useState(false);
  const [revealingSlug, setRevealingSlug] = useState<string | null>(null);
  const [targetSummary, setTargetSummary] = useState<TargetSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState("00:00:00");
  const [selectedInfernokultColumnKeys, setSelectedInfernokultColumnKeys] = useState<string[]>([]);
  const hasRestoredDateModeProgressRef = useRef<Record<"daily" | "infernokult", boolean>>({
    daily: false,
    infernokult: false,
  });
  const winRevealTimeoutRef = useRef<number | null>(null);
  const revealSlugTimeoutRef = useRef<number | null>(null);
  const modeProgressRef = useRef<Record<PlayMode, ModeProgress>>({
    daily: createEmptyModeProgress(),
    free: createEmptyModeProgress(),
    infernokult: createEmptyModeProgress(),
  });

  const displayedColumnHeaders =
    selectedMode === "infernokult" && selectedInfernokultColumnKeys.length > 0 && puzzleMeta
      ? puzzleMeta.columns.filter((col) => selectedInfernokultColumnKeys.includes(col.key))
      : puzzleMeta?.columns ?? [];

  const displayedGuesses: GuessResult[] =
    selectedMode === "infernokult" && selectedInfernokultColumnKeys.length > 0
      ? guesses.map((guess) => ({
          ...guess,
          results: guess.results.filter((result) =>
            selectedInfernokultColumnKeys.includes(result.key)
          ),
        }))
      : guesses;

  const clearPendingTimers = useCallback(() => {
    if (winRevealTimeoutRef.current != null) {
      window.clearTimeout(winRevealTimeoutRef.current);
      winRevealTimeoutRef.current = null;
    }
    if (revealSlugTimeoutRef.current != null) {
      window.clearTimeout(revealSlugTimeoutRef.current);
      revealSlugTimeoutRef.current = null;
    }
  }, []);

  const applyModeProgress = useCallback((mode: PlayMode) => {
    const progress = modeProgressRef.current[mode];
    setPuzzleMeta(progress.puzzleMeta);
    setFreeTargetCom2usId(progress.freeTargetCom2usId);
    setGuesses(progress.guesses);
    setIsWin(progress.isWin);
    setIsWinRevealPending(progress.isWinRevealPending);
    setRevealingSlug(progress.revealingSlug);
    setTargetSummary(progress.targetSummary);
    setError(progress.error);
    setSubmitting(progress.submitting);
    setLoadingFreeTarget(progress.loadingFreeTarget);
  }, []);

  useEffect(() => {
    if (selectedMode !== "infernokult") return;
    if (!puzzleMeta?.columns?.length) return;

    setSelectedInfernokultColumnKeys((current) => {
      if (current.length === 0) {
        return puzzleMeta.columns.map((col) => col.key);
      }

      const validKeys = new Set(puzzleMeta.columns.map((col) => col.key));
      const filtered = current.filter((key) => validKeys.has(key));
      return filtered.length > 0 ? filtered : puzzleMeta.columns.map((col) => col.key);
    });
  }, [puzzleMeta, selectedMode]);

  const persistCurrentModeProgress = useCallback(
    (mode: PlayMode) => {
      modeProgressRef.current[mode] = {
        puzzleMeta,
        freeTargetCom2usId,
        guesses,
        isWin,
        isWinRevealPending,
        revealingSlug,
        targetSummary,
        error,
        submitting,
        loadingFreeTarget,
      };
    },
    [
      error,
      freeTargetCom2usId,
      guesses,
      isWin,
      isWinRevealPending,
      loadingFreeTarget,
      puzzleMeta,
      revealingSlug,
      submitting,
      targetSummary,
    ]
  );

  const resetRound = useCallback(() => {
    clearPendingTimers();
    setGuesses([]);
    setIsWin(false);
    setIsWinRevealPending(false);
    setRevealingSlug(null);
    setTargetSummary(null);
    setError(null);
    setSubmitting(false);
  }, [clearPendingTimers]);

  const fetchFreeTarget = useCallback(async (previousTargetCom2usId?: number) => {
    setLoadingFreeTarget(true);

    try {
      const res = await fetch("/api/classic/free-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previousTargetCom2usId }),
      });

      const data = (await res.json()) as FreeTargetResponse;
      if (!res.ok || data.error || data.targetCom2usId == null) {
        setError(data.error ?? "Failed to generate a free-play target.");
        return;
      }

      setFreeTargetCom2usId(data.targetCom2usId);
    } catch {
      setError("Failed to generate a free-play target.");
    } finally {
      setLoadingFreeTarget(false);
    }
  }, []);

  // Load puzzle metadata / free target only when missing for current mode.
  useEffect(() => {
    if (!puzzleMeta) {
      const params = new URLSearchParams({ mode: selectedMode });

      fetch(`/api/classic/puzzle?${params.toString()}`)
        .then((r) => r.json() as Promise<PuzzleMeta>)
        .then((data) => setPuzzleMeta(data))
        .catch(() =>
          setError(
            selectedMode === "daily"
              ? "Failed to load today's puzzle. Try refreshing."
              : "Failed to load free-play settings. Try refreshing."
          )
        );
    }

    if (selectedMode === "free" && freeTargetCom2usId == null && !loadingFreeTarget) {
      void fetchFreeTarget();
    }
  }, [fetchFreeTarget, freeTargetCom2usId, loadingFreeTarget, puzzleMeta, selectedMode]);

  useEffect(() => {
    return () => {
      clearPendingTimers();
    };
  }, [clearPendingTimers]);

  useEffect(() => {
    if (!isDateBasedMode(selectedMode)) return;

    const franceDateAtMount = getDateInTimeZone("Europe/Paris");
    const intervalId = window.setInterval(() => {
      const currentFranceDate = getDateInTimeZone("Europe/Paris");
      if (currentFranceDate !== franceDateAtMount) {
        window.location.reload();
      }
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedMode]);

  useEffect(() => {
    if (!isDateBasedMode(selectedMode)) return;

    const updateCountdown = () => {
      setNextRefreshCountdown(formatDurationHhMmSs(getTimeUntilNextParisMidnightMs()));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedMode]);

  useEffect(() => {
    if (!isDateBasedMode(selectedMode)) return;
    if (!puzzleMeta?.date) return;
    if (hasRestoredDateModeProgressRef.current[selectedMode]) return;

    hasRestoredDateModeProgressRef.current[selectedMode] = true;
    const storageKey = MODE_PROGRESS_STORAGE_KEYS[selectedMode];

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as DailyProgressSnapshot;
      if (!parsed || parsed.date !== puzzleMeta.date) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      setGuesses(parsed.guesses ?? []);
      setIsWin(Boolean(parsed.isWin));
      setTargetSummary(parsed.targetSummary ?? null);
      modeProgressRef.current[selectedMode] = {
        ...modeProgressRef.current[selectedMode],
        puzzleMeta,
        guesses: parsed.guesses ?? [],
        isWin: Boolean(parsed.isWin),
        targetSummary: parsed.targetSummary ?? null,
      };
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [puzzleMeta, selectedMode]);

  useEffect(() => {
    if (!isDateBasedMode(selectedMode)) return;
    if (!puzzleMeta?.date) return;

    const storageKey = MODE_PROGRESS_STORAGE_KEYS[selectedMode];

    const snapshot: DailyProgressSnapshot = {
      date: puzzleMeta.date,
      guesses,
      isWin,
      targetSummary,
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // Ignore storage errors (private mode / quota).
    }
  }, [guesses, isWin, puzzleMeta?.date, selectedMode, targetSummary]);

  const isGameOver = isWin || isWinRevealPending;

  const getShareEmoji = useCallback((status: GuessResult["results"][number]["status"]) => {
    if (status === "match") return "🟩";
    if (status === "unknown") return "⬛";
    return "🟥";
  }, []);

  const buildShareText = useCallback(() => {
    const dateLabel = puzzleMeta?.date ?? getDateInTimeZone("Europe/Paris");

    // Guesses are prepended in state; reverse to share in chronological order.
    const gridRows = [...guesses]
      .reverse()
      .map((guess) => guess.results.map((result) => getShareEmoji(result.status)).join(""));

    return [
      `I solved the ${getModeTitle(selectedMode)} - ${dateLabel}`,
      "",
      ...gridRows,
      "",
      "Try it:",
      "https://www.swdle.xyz/",
    ].join("\n");
  }, [getShareEmoji, guesses, puzzleMeta?.date, selectedMode]);

  const handleShare = useCallback(async () => {
    const shareText = buildShareText();

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setShareFeedback("Result copied to clipboard.");
        return;
      }

      setShareFeedback("Clipboard is not available on this browser.");
    } catch {
      setShareFeedback("Could not copy right now. Please try again.");
    }
  }, [buildShareText]);

  const handleGuess = useCallback(
    async (suggestion: MonsterSuggestion) => {
      if (isGameOver || submitting) return;

      if (selectedMode === "free" && freeTargetCom2usId == null) {
        setError("Free-play target is not ready yet. Please wait a second.");
        return;
      }

      // Prevent duplicate guesses
      if (guesses.some((g) => g.guess.slug === suggestion.slug)) {
        setError(`You already guessed ${suggestion.displayName}.`);
        return;
      }

      setError(null);
      setSubmitting(true);

      try {
        const res = await fetch("/api/classic/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: suggestion.slug,
            mode: selectedMode,
            targetCom2usId:
              selectedMode === "free" ? freeTargetCom2usId ?? undefined : undefined,
          }),
        });

        const data = (await res.json()) as GuessApiResponse;

        if (!res.ok || data.error) {
          setError(data.error ?? "An error occurred. Please try again.");
          return;
        }

        const result: GuessResult = {
          guess: data.guess,
          results: data.results,
          isWin: data.isWin,
        };

        const columnsCount =
          selectedMode === "infernokult"
            ? Math.max(1, selectedInfernokultColumnKeys.length)
            : puzzleMeta?.columns.length ?? data.results.length;
        const revealDurationMs =
          columnsCount * CELL_REVEAL_STAGGER_MS + CELL_REVEAL_DURATION_MS;

        // Batch both state updates so the row renders black from the first paint
        setGuesses((prev) => [result, ...prev]);
        setRevealingSlug(result.guess.slug);

        // Clear the reveal animation once all cells have flipped in
        revealSlugTimeoutRef.current = window.setTimeout(() => {
          setRevealingSlug(null);
        }, revealDurationMs);

        if (data.isWin) {
          setIsWinRevealPending(true);

          winRevealTimeoutRef.current = window.setTimeout(() => {
            setIsWin(true);
            setTargetSummary(data.targetSummary ?? null);
            setIsWinRevealPending(false);
          }, revealDurationMs);
        }
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      freeTargetCom2usId,
      guesses,
      isGameOver,
      puzzleMeta?.columns.length,
      selectedInfernokultColumnKeys.length,
      selectedMode,
      submitting,
    ]
  );

  const handleSwitchMode = useCallback(
    (mode: PlayMode) => {
      if (mode === selectedMode) return;
      clearPendingTimers();
      persistCurrentModeProgress(selectedMode);
      applyModeProgress(mode);
      setSelectedMode(mode);
    },
    [applyModeProgress, clearPendingTimers, persistCurrentModeProgress, selectedMode]
  );

  const handleRefreshFreePlay = useCallback(async () => {
    const previousTarget = freeTargetCom2usId ?? undefined;
    resetRound();
    modeProgressRef.current.free = createEmptyModeProgress();
    await fetchFreeTarget(previousTarget);
  }, [fetchFreeTarget, freeTargetCom2usId, resetRound]);

  const handleShowFreePlaySolution = useCallback(async () => {
    if (selectedMode !== "free" || freeTargetCom2usId == null || submitting || loadingFreeTarget) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/classic/free-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCom2usId: freeTargetCom2usId }),
      });

      const data = (await res.json()) as FreeSolutionResponse;
      if (!res.ok || data.error || !data.targetSummary) {
        setError(data.error ?? "Failed to reveal the free-play solution.");
        return;
      }

      clearPendingTimers();
      setRevealingSlug(null);
      setIsWinRevealPending(false);
      setTargetSummary(data.targetSummary);
      setIsWin(true);
    } catch {
      setError("Failed to reveal the free-play solution.");
    } finally {
      setSubmitting(false);
    }
  }, [
    clearPendingTimers,
    freeTargetCom2usId,
    loadingFreeTarget,
    selectedMode,
    submitting,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-8">
      {/* Mode menu */}
      <div className="flex w-full flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 sm:flex-row sm:items-center sm:justify-center">
        <button
          type="button"
          onClick={() => handleSwitchMode("daily")}
          className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:w-auto ${
            selectedMode === "daily"
              ? "bg-amber-400 text-zinc-950"
              : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          Classic Daily Challenge
        </button>
        <button
          type="button"
          onClick={() => handleSwitchMode("free")}
          className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:w-auto ${
            selectedMode === "free"
              ? "bg-amber-400 text-zinc-950"
              : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          Free Play
        </button>
        <button
          type="button"
          onClick={() => handleSwitchMode("infernokult")}
          className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:w-auto ${
            selectedMode === "infernokult"
              ? "bg-amber-400 text-zinc-950"
              : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          Infernokult
        </button>
      </div>

      {/* Header */}
      <div className="space-y-1 text-center">
        <h3 className="px-2 text-xs text-zinc-300 sm:text-sm">By B4tiste with the help of Layn</h3>
        <h1 className="text-2xl font-bold text-amber-400 sm:text-3xl">
          {getModeTitle(selectedMode)}
        </h1>
        {puzzleMeta && (
          <div className="space-y-1">
            <p className="text-sm text-zinc-200">
              {isDateBasedMode(selectedMode)
                ? `${puzzleMeta.date} - ${guesses.length} attempts`
                : `${guesses.length} guesses in this round`}
            </p>
            {isDateBasedMode(selectedMode) && (
              <p className="text-zinc-400 text-xs">
                Next monster refresh in {nextRefreshCountdown}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Helper section */}
      <details className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4" open={guesses.length === 0}>
        <summary className="cursor-pointer select-none text-sm font-semibold text-amber-300">
          HELPER - How to play
        </summary>
        <div className="mt-3 space-y-3 text-sm text-zinc-300 leading-relaxed">
          <p>
            Guess a monster using the search bar. Each guess reveals colored clues for every column.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Green means correct.
            </li>
            <li>
              Red means incorrect.
            </li>
            <li>
              More than X means the target value is higher than X.
            </li>
            <li>
              Less than X means the target value is lower than X.
            </li>
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
              <p className="font-semibold text-zinc-100">Classic Daily Challenge</p>
              <p className="text-zinc-400 text-xs mt-1">
                One daily target. Keep guessing until you find it.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
              <p className="font-semibold text-zinc-100">Free Play</p>
              <p className="text-zinc-400 text-xs mt-1">
                Unlimited rounds. Use the refresh button to get a new target.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 sm:col-span-2">
              <p className="font-semibold text-zinc-100">Infernokult</p>
              <p className="text-zinc-400 text-xs mt-1">
                Same daily target with extra Base HP, Base ATK and Base DEF columns.
              </p>
            </div>
          </div>
        </div>
      </details>

      {selectedMode === "infernokult" && puzzleMeta && (
        <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
          <p className="text-sm font-semibold text-amber-300">Column selection</p>
          <p className="mt-1 text-xs text-zinc-400">
            Choose which clues to display in the Infernokult grid.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {puzzleMeta.columns.map((column: ColumnMeta) => {
              const checked = selectedInfernokultColumnKeys.includes(column.key);

              return (
                <label
                  key={column.key}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedInfernokultColumnKeys((current) => {
                        if (checked) {
                          if (current.length <= 1) return current;
                          return current.filter((key) => key !== column.key);
                        }

                        return [...current, column.key];
                      });
                    }}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-amber-400 focus:ring-amber-400"
                  />
                  <span>{column.label}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            At least one column must stay enabled.
          </p>
        </div>
      )}

      {selectedMode === "free" && (
        <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => void handleRefreshFreePlay()}
            disabled={loadingFreeTarget || submitting || isWinRevealPending}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {loadingFreeTarget ? "Generating target..." : "Refresh free-play monster"}
          </button>
          {!isWin && (
            <button
              type="button"
              onClick={() => void handleShowFreePlaySolution()}
              disabled={loadingFreeTarget || submitting || freeTargetCom2usId == null}
              className="w-full rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Show solution
            </button>
          )}
        </div>
      )}

      {/* Win / Loss banners */}
      {isWin && (
        <div className="w-full rounded-xl border border-emerald-600 bg-emerald-800 px-4 py-4 text-center sm:px-6">
          <p className="text-base font-semibold text-emerald-200 sm:text-lg">
            🎉 You found it in {guesses.length} guess{guesses.length === 1 ? "" : "es"}!
          </p>
          {targetSummary && (
            <div className="mt-3 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={targetSummary.image}
                alt={targetSummary.displayName}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full"
              />
              <span className="text-lg font-bold text-white sm:text-xl">
                {targetSummary.displayName}
              </span>
            </div>
          )}
          {selectedMode === "free" && (
            <p className="mt-3 text-emerald-100 text-sm">
              Hit the Refresh Button to start a new round.
            </p>
          )}
        </div>
      )}

      {isDateBasedMode(selectedMode) && isWin && guesses.length > 0 && (
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => void handleShare()}
            className="w-full rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 sm:w-auto"
          >
            Share your result
          </button>
          {shareFeedback && <p className="text-xs text-zinc-300">{shareFeedback}</p>}
        </div>
      )}

      {/* Search input */}
      {!isWin && (
        <div className="flex w-full flex-col items-center gap-2">
          <MonsterSearchInput
            onSelect={handleGuess}
            disabled={
              submitting ||
              isWinRevealPending ||
              loadingFreeTarget ||
              (selectedMode === "free" && freeTargetCom2usId == null)
            }
          />
          {submitting && (
            <p className="text-zinc-400 text-sm animate-pulse">Checking…</p>
          )}
          {selectedMode === "free" && loadingFreeTarget && (
            <p className="text-zinc-400 text-sm animate-pulse">Preparing next target…</p>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {/* Legend */}
      {guesses.length > 0 && (
        <div className="grid w-full gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400 sm:flex sm:flex-wrap sm:justify-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0">
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-green-700" /> Correct (green)
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-red-700" /> Incorrect (red)
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-red-700" /> More than X : You are looking for a higher value
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-red-700" /> Less than X : You are looking for a lower value
          </span>
        </div>
      )}

      {/* Guess grid */}
      {puzzleMeta && guesses.length > 0 && (
        <GuessGrid
          guesses={displayedGuesses}
          columnHeaders={displayedColumnHeaders}
          revealingSlug={revealingSlug}
        />
      )}

      {isDateBasedMode(selectedMode) && puzzleMeta?.previousTargetSummary && (
        <div className="mt-2 w-full rounded-lg bg-black/30 px-4 py-3 text-center shadow-sm backdrop-blur-[1px] sm:mt-4 sm:py-2">
          <p className="text-sm font-medium text-white">
            Yesterday&apos;s monster was{" "}
            <span className="text-emerald-400">
              {puzzleMeta.previousTargetSummary.displayName}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

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

type PlayMode = "daily" | "free";

function getClientDate(): string {
  // Returns YYYY-MM-DD in browser local timezone.
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getClientTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface PuzzleMeta {
  mode: PlayMode;
  date: string;
  columns: { key: string; label: string }[];
  maxAttempts: number;
  previousTargetSummary?: TargetSummary;
}

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
  const winRevealTimeoutRef = useRef<number | null>(null);
  const revealSlugTimeoutRef = useRef<number | null>(null);
  const modeProgressRef = useRef<Record<PlayMode, ModeProgress>>({
    daily: createEmptyModeProgress(),
    free: createEmptyModeProgress(),
  });

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
      const clientDate = getClientDate();
      const tz = getClientTimeZone();
      const params = new URLSearchParams({ clientDate, tz, mode: selectedMode });

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

  const maxAttempts = puzzleMeta?.maxAttempts ?? 10;
  const isAttemptLimited = selectedMode === "daily";
  const hasAttemptsRemaining = !isAttemptLimited || guesses.length < maxAttempts;
  const isGameOver = isWin || isWinRevealPending || !hasAttemptsRemaining;

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
            clientDate: getClientDate(),
            tz: getClientTimeZone(),
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

        const columnsCount = puzzleMeta?.columns.length ?? data.results.length;
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

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto px-4 py-8">
      {/* Mode menu */}
      <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
        <button
          type="button"
          onClick={() => handleSwitchMode("daily")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
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
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            selectedMode === "free"
              ? "bg-amber-400 text-zinc-950"
              : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          Free Play
        </button>
      </div>

      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-amber-400">
          {selectedMode === "daily" ? "Classic Daily Challenge" : "Classic Free Play"}
        </h1>
        {puzzleMeta && (
          <p className="text-zinc-500 text-sm">
            {selectedMode === "daily"
              ? `${puzzleMeta.date} - ${guesses.length}/${maxAttempts} attempts`
              : `${guesses.length} guesses in this round`}
          </p>
        )}
      </div>

      {/* Helper section */}
      <details className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-4" open={guesses.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-amber-300 select-none">
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
                One daily target with a limited number of attempts.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
              <p className="font-semibold text-zinc-100">Free Play</p>
              <p className="text-zinc-400 text-xs mt-1">
                Unlimited rounds. Use the refresh button to get a new target.
              </p>
            </div>
          </div>
        </div>
      </details>

      {selectedMode === "free" && (
        <div className="w-full flex justify-center">
          <button
            type="button"
            onClick={() => void handleRefreshFreePlay()}
            disabled={loadingFreeTarget || submitting || isWinRevealPending}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingFreeTarget ? "Generating target..." : "Refresh free-play monster"}
          </button>
        </div>
      )}

      {/* Win / Loss banners */}
      {isWin && (
        <div className="w-full rounded-xl bg-emerald-800 border border-emerald-600 px-6 py-4 text-center">
          <p className="text-emerald-200 font-semibold text-lg">
            🎉 You found it in {guesses.length} guess{guesses.length === 1 ? "" : "es"}!
          </p>
          {targetSummary && (
            <div className="mt-2 flex items-center justify-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={targetSummary.image}
                alt={targetSummary.displayName}
                width={48}
                height={48}
                className="rounded-full"
              />
              <span className="text-white font-bold text-xl">
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

      {selectedMode === "daily" && !isWin && guesses.length >= maxAttempts && (
        <div className="w-full rounded-xl bg-red-900 border border-red-700 px-6 py-4 text-center">
          <p className="text-red-200 font-semibold">
            Game over! Come back tomorrow for a new monster.
          </p>
        </div>
      )}

      {/* Search input */}
      {!isWin && hasAttemptsRemaining && (
        <div className="flex flex-col items-center gap-2 w-full">
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
        <div className="flex flex-wrap gap-3 text-xs text-zinc-400 justify-center">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded bg-green-700" /> Correct (green)
          </span>
          <span>|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded bg-red-700" /> Incorrect (red)
          </span>
          <span>|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded bg-red-700" /> More than X : You are looking for a higher value
          </span>
          <span>|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded bg-red-700" /> Less than X : You are looking for a lower value
          </span>
        </div>
      )}

      {/* Guess grid */}
      {puzzleMeta && guesses.length > 0 && (
        <GuessGrid guesses={guesses} columnHeaders={puzzleMeta.columns} revealingSlug={revealingSlug} />
      )}

      {selectedMode === "daily" && puzzleMeta?.previousTargetSummary && (
        <div className="mt-4 w-full rounded-lg bg-black/30 px-4 py-2 text-center shadow-sm backdrop-blur-[1px]">
          <p className="text-sm font-medium text-white">
            Yesterday's monster was{" "}
            <span className="text-emerald-400">
              {puzzleMeta.previousTargetSummary.displayName}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

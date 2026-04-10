"use client";

/**
 * MonsterSearchInput
 *
 * Controlled search input that fetches suggestions from the API
 * and lets the player select a monster to guess.
 */

import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";

export interface MonsterSuggestion {
  slug: string;
  displayName: string;
  shortName: string;
  image: string;
  element: string;
}

interface Props {
  onSelect: (suggestion: MonsterSuggestion) => void;
  disabled?: boolean;
}

export function MonsterSearchInput({ onSelect, disabled = false }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MonsterSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/classic/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = (await res.json()) as { results: MonsterSuggestion[] };
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(s: MonsterSuggestion) {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onSelect(s);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a monster…"
        disabled={disabled}
        className={clsx(
          "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500",
          "focus:outline-none focus:ring-2 focus:ring-amber-400",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {loading && (
        <div className="absolute right-3 top-2.5 text-zinc-400 text-sm">…</div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg overflow-hidden max-h-[360px] overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt={s.displayName}
                  width={32}
                  height={32}
                  className="rounded-full shrink-0"
                />
                <span>
                  <span className="font-medium">{s.displayName}</span>
                  {s.shortName && s.shortName !== s.displayName && (
                    <span className="ml-1 text-zinc-400">({s.shortName})</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && suggestions.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-400">
          No monsters found.
        </div>
      )}
    </div>
  );
}

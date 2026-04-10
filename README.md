# Summoners War Xdle

A daily Wordle-style guessing game for **Summoners War: Sky Arena** monsters.
Each day a new monster is picked and players must identify it by comparing attributes such as element, archetype, natural stars, and base stats.

---

## Stack

| Tool | Role |
|------|------|
| Next.js 16 (App Router) | Full-stack React framework |
| TypeScript (strict) | Type safety everywhere |
| Tailwind CSS v4 | Utility-first styling |
| Zod v4 | Schema validation for all JSON data |
| pnpm | Package manager |
| tsx | TypeScript script runner (data pipeline) |

No database, no Redis, no authentication in V1.

---

## Project Structure

```
summoners-war-xdle/
├── data/
│   ├── raw/              # Downloaded source JSON files (gitignored)
│   ├── snapshots/        # Merged intermediate data (gitignored)
│   └── generated/        # Final datasets consumed by the game (gitignored)
├── scripts/
│   ├── download-datasets.ts   # Downloads Lucksack + SWARFARM JSON
│   ├── merge-datasets.ts      # Merges on com2us_id pivot
│   ├── build-classic-dataset.ts  # Normalizes to ClassicMonster[]
│   ├── seed-daily-puzzles.ts  # Seeds daily puzzle picks
│   └── lib/env.ts             # Minimal .env loader for scripts
├── src/
│   ├── app/
│   │   ├── page.tsx           # Home page
│   │   ├── classic/page.tsx   # Classic mode entry point
│   │   └── api/classic/
│   │       ├── puzzle/route.ts  # GET /api/classic/puzzle
│   │       ├── guess/route.ts   # POST /api/classic/guess
│   │       └── search/route.ts  # GET /api/classic/search
│   ├── components/
│   │   ├── classic/
│   │   │   ├── ClassicGame.tsx        # Main game client component
│   │   │   ├── GuessGrid.tsx          # Comparison grid
│   │   │   └── MonsterSearchInput.tsx # Autocomplete search
│   │   ├── game/   # Shared game UI (future modes)
│   │   └── ui/     # Generic UI primitives
│   └── lib/
│       ├── schemas/
│       │   ├── lucksack.schema.ts       # Lucksack catalog Zod schema
│       │   ├── swarfarm.schema.ts       # SWARFARM bestiary Zod schema
│       │   └── classic-monster.schema.ts # ClassicMonster Zod schema
│       ├── domain/
│       │   └── monster.ts     # RawMergedMonster type + merge logic
│       ├── classic/
│       │   ├── types.ts       # ClassicColumnKey, GuessResult, etc.
│       │   ├── columns.ts     # Config-driven column definitions
│       │   ├── comparators.ts # Pure comparison functions
│       │   └── game-engine.ts # processGuess, buildPuzzleMeta
│       ├── datasets/
│       │   ├── load-classic-dataset.ts  # Reads classic-monsters.json
│       │   └── load-daily-puzzle.ts     # Resolves daily target
│       └── utils/   # Shared utilities (future)
```

---

## Commands

### Setup

```bash
# Install dependencies
pnpm install

# Copy env file and fill in DATASET_SEED
cp .env.example .env
```

### Data Pipeline

```bash
# Download raw JSON from Lucksack + SWARFARM
pnpm data:download

# Merge sources on com2us_id pivot
pnpm data:merge

# Normalize to ClassicMonster dataset
pnpm data:classic

# Seed the next 365 days of daily puzzles
pnpm data:puzzles

# Run the full pipeline at once
pnpm data:build
```

### Development

```bash
# Start dev server (make sure data is built first)
pnpm data:build
pnpm dev
```

### Production Build

```bash
# Build (runs data pipeline then Next.js build)
pnpm build
pnpm start
```

---

## Data Pipeline

```
Lucksack monsters_catalog.json ─┐
                                 ├── merge-datasets.ts ──> snapshots/merged-monsters.json
SWARFARM monsters_elements.json ─┘
                                              │
                                 build-classic-dataset.ts
                                              │
                              generated/classic-monsters.json
                                              │
                                 seed-daily-puzzles.ts
                                              │
                               generated/daily-puzzles.json
```

**Key design decisions:**
- The pivot field is `com2us_id`. Monsters present in only one source are preserved with null for missing fields.
- All JSON inputs are validated with Zod at script time.
- The `DATASET_SEED` env variable ensures daily puzzle picks are stable and reproducible.
- No API is called at runtime — the game reads only from `data/generated/`.

---

## Classic Mode

Players are shown an 8-column grid revealing how their guess compares to the secret monster:

| Column | Type | Result options |
|--------|------|----------------|
| Element | enum | match / mismatch |
| Archetype | enum | match / mismatch |
| Natural Stars | number | match / higher / lower |
| Awaken Level | number | match / higher / lower |
| Speed | number | match / higher / lower |
| Base HP | number | match / higher / lower |
| Base ATK | number | match / higher / lower |
| Base DEF | number | match / higher / lower |

- Up to **10 guesses** per day.
- A new target is revealed daily at midnight UTC.
- Only **searchable** and **obtainable** monsters can be daily targets.

---

## TODO — Future Modes

- [ ] **Mode 2 (TBD)**: Could be a skill-based mode, image-based mode, or audio mode.
  - Planned directories: `src/app/[mode]/`, `src/app/api/[mode]/`, `src/components/[mode]/`
  - Dataset pipeline should be extended with mode-specific scripts under `scripts/`
- [ ] Family name lookup table (currently `familyName` is always `null`)
- [ ] Share button (copy guess pattern to clipboard)
- [ ] Streak tracking (localStorage)
- [ ] Monster image in the guess grid thumbnail
- [ ] Keyboard navigation for search suggestions
- [ ] Dark/light theme toggle
- [ ] Error boundary + retry for failed API calls

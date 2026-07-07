# Cats + Dogs Parity — Implementation Plan

**Status:** Proposed · **Scope:** add full cat/dog parity to Fetch, on an
N‑species‑ready foundation · **Whole purpose:** get animals rehomed.

---

## 1. Locked decisions (from product)

| # | Decision | Consequence for this plan |
|---|----------|---------------------------|
| 1 | **Build for N species internally, but scope all work + copy to cat/dog only.** | Data model is extensible (a `species` *string*, not a boolean or 2‑value enum). UI/marketing say "cats and dogs" explicitly — no generic "pets" copy, no third species surfaced. |
| 2 | **Per‑species crowns.** Dashboard shows **both** Top Dog and Top Cat, *unless* the user has explicitly filtered to one species. | `weekly_winners` gains a `species` dimension; ranking computes one winner **per species per week**; a persistent species filter drives dashboard + swipe. |
| 3 | **Parks stay species‑agnostic.** Revisit (gate to dogs?) later, based on data. | No species gating on parks / check‑ins / play dates. They already key on the pet id, so cats work for free. Optionally record species on attendance for later analysis. |
| 4 | Royale (cross‑species crown) and species beyond cat/dog are **future**. | Schema supports them; we don't build the UI now. |

## 2. Guiding principles

- **One entity, one discriminator.** Do *not* duplicate the stack for cats. A single animal entity with a `species` column; every satellite table (votes, photos, follows, lost reports, transfers, adoption, RSVPs, check‑ins) inherits species transitively through the pet id and needs **no schema change**.
- **Neutral data, specific copy.** Internals are species‑neutral and N‑ready; the *presentation layer* speaks only "cats and dogs."
- **Mirror the existing patterns.** The schema has **zero SQL enums and zero CHECK constraints** — every vocabulary is a `String` validated in Python (see `mix_type`). We keep that: `species` is a `String(20)` with an app‑level allowed set, so adding a species later is a config change, not a migration.
- **Each phase ships on its own** and leaves the app working. Cats become visible to users only in Phase 2.

---

## 3. ⚠ The one decision to confirm before Phase 1: internal rename

The functional goal (N species) is met by the `species` **column alone**. The
open question is purely **semantic hygiene**: today the core table is `dogs`
and the FK is `dog_id` in 10 tables. Do we rename to `pets` / `pet_id`?

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A. Rename `dogs`→`pets`, `dog_id`→`pet_id` (physical)** | No permanent "why do cats live in the `dogs` table" debt; clean N‑species model; cheapest to do *now* while in beta | One broad, near‑irreversible migration: 10 FK tables, ~26 migrations of history, every router/schema/test, all frontend query keys, and the public `/dogs/{id}` URL | **Recommended — do it in Phase 1**, before any new cat code is written on the old names. Keep a redirect `/dogs/{id}` → `/pets/{id}` for links already shared in the wild. |
| **B. Keep `dogs`/`dog_id` physically; generalize only the API/UI vocabulary** | Much smaller, lower‑risk change now | Permanent internal semantic debt; every future dev meets a `dogs` table full of cats | Fallback only if we want to defer migration risk. |

This plan is written so the `species` work (mandatory) and the rename
(optional, recommended) are **orthogonal** — pick B and the only change is you
skip §8‑migration‑2 and keep the `dog`/`dog_id` identifiers. Everything else
holds. **Recommendation: Option A, sequenced first in Phase 1.**

> Naming: the app stays **Fetch** and copy stays "cats and dogs." "Rate My
> Dog" becomes a species‑aware title. Nothing forces an app‑name change.

---

## 4. Target data model

Three columns and one swapped constraint. Everything else is inherited.

| Table | Change | Backfill / notes |
|-------|--------|------------------|
| `pets` (was `dogs`) | **+ `species` `String(20)` NOT NULL, default/server_default `'dog'`** | Backfill existing rows → `'dog'`. App set `SPECIES = ("dog", "cat")`. |
| `breeds` | **+ `species` `String(20)` NOT NULL, default `'dog'`, indexed** | Backfill existing 195 → `'dog'`. Seed cat breeds with `species='cat'`. `group` stays nullable (dog AKC groups don't apply to cats). |
| `weekly_winners` | **+ `species` `String(20)` NOT NULL default `'dog'`**; **drop `UNIQUE(week_bucket)` → `UNIQUE(week_bucket, species)`** | Backfill existing → `'dog'`. This is the only structural blocker to per‑species crowns (today `week_bucket` is `unique=True`). |
| 10 FK tables + `dog_breeds` join | **No column change.** (Only `dog_id`→`pet_id` rename if Option A.) | Species is reached via the pet row. |

No new `sex` / `size` / `weight` columns — they don't exist today for dogs
either, and neither species needs them for parity. (Noted as a future option.)

---

## 5. Backend changes (by file)

### Core model & vocab
- **`models/dog.py` → `pet.py`** — add `species` column + module `SPECIES` tuple. Rename class `Dog`→`Pet`, table `dogs`→`pets`, relationship `User.dogs`→`User.pets` (Option A).
- **`models/breed.py`** — add `species` column + index; `Breed.dogs`→`Breed.pets`; `dog_breeds` join `dog_id`→`pet_id` (Option A).
- **`models/weekly_winner.py`** — add `species`; `__table_args__ = (UniqueConstraint("week_bucket", "species"),)`; `dog_id`→`pet_id` (Option A).
- **`breed_data.py`** — add `CAT_BREED_SEED` (~40–70 CFA/TICA breeds); the seeder writes `species` per list. Keep the existing 195 as the dog set.
- **`schemas/dog.py` → `pet.py`** —
  - Add `species` to `PetCreate` / `PetUpdate` / `PetOut`; add `_validate_species` mirroring `_validate_mix_type`.
  - `VALID_TRAITS` → species‑keyed `DOG_TRAITS` / `CAT_TRAITS` (shared: "Good with kids", "Couch potato", "Playful"; dog‑only: "Loves fetch", "Swimmer"; cat‑only: "Lap cat", "Mouser", "Indoor"). `_validate_traits` checks against the pet's species set.
  - `mix_type` **values stay the same 4**; only the *display label* varies by species (dog "Mystery mutt" / cat "Domestic shorthair / moggie"). Rendered in `breed_display`, not stored differently.

### Services
- **`services/breed_display.py`** — take `species`; branch the dog‑flavored copy ("mystery mutt", "mixed breed") to cat equivalents.
- **`services/dog_serializer.py` → `pet_serializer.py`** — add `species=pet.species` to the `PetOut(...)` constructor.
- **`services/feed_service.py`** — `get_feed(user_id, db, *, species=None, limit)`: add `Pet.species == species` to the where‑block **only when species is set** (unset = mixed "all" deck). The already‑voted / block / photo / adopted filters are unchanged.
- **`services/ranking_service.py`** — the per‑species heart:
  - `get_current_leaderboard(db, *, species, limit)` — join `Vote → Pet`, add `Pet.species == species` to the aggregation `where`.
  - `_pick_winner_for_week(db, week, *, species, …)` — same join/filter; upsert keyed on `(week, species)`.
  - `compute_weekly_winner` / `pick_current_winner` — **loop `for species in SPECIES`**, computing/upserting a winner each. (Celery beat schedule in `worker.py` is unchanged — the loop lives in the service.)
  - `get_dog_stats` → `get_pet_stats` — scope the "rank among peers / field size" subquery to the pet's **own** species (a cat ranks among cats). Crown history query is unchanged (keyed on pet id).
  - `_notify_winner` — title "Top **Dog**" / "Top **Cat**" by species; link uses the pet id.

### Routers
- **`routers/dogs.py` → `pets.py`** — create/update accept `species`; **`_fetch_breeds` must reject breeds whose `species` ≠ the pet's species** (400) — this is the rule that stops a cat being tagged a Labrador. `GET /explore` gains the same `?species=` filter (its candidate query is separate from the feed's). `GET /{id}` etc. serve both species.
- **`routers/feed.py`** — thread `?species=` through to `get_feed`.
- **`routers/rankings.py`** — `?species=` on `/current`, `/winner/current`, `/history`, `/pets/{id}/stats`; include `species` in responses.
- **`routers/public.py`** — `PublicDogOut`→`PublicPetOut` + `species`; species‑aware copy/emoji; add per‑species top endpoint (keep `/top-dog`, add `/top-cat`, or a single `/top?species=`).
- **`routers/breeds.py`** — `?species=` filter on the public list; admin breed create takes `species`.
- **`main.py`** — register under `/api/v1/pets`; (Option A) optionally keep a `/api/v1/dogs` alias + `/dogs/{id}` redirect for shared links.

---

## 6. Frontend changes (by area)

### Types & API
- **`types/index.ts`** — `Dog`→`Pet` with `species: 'dog' | 'cat'`. `dog_id`/`dog_name` on `Vote` / `LeaderboardEntry` / `WeeklyWinner` / `DogStats` → `pet_*` (Option A). Add `species` to leaderboard/winner types.
- **`api/dogs.ts` → `pets.ts`** — `PetPayload` + `species`; `listBreeds(species)`; export `DOG_TRAITS` / `CAT_TRAITS`.
- **`api/feed.ts`** — `getFeed(species?)`.
- **`api/rankings.ts`** — species param on each call.
- **`api/breeds.ts`** — `listBreeds(species)`.

### The species filter (cross‑cutting UX contract)
- **New `useSpeciesFilter` hook** — persistent preference `all | dog | cat`, default `all`, stored in `localStorage` (v1). Passed as `?species=` to feed/explore/rankings. (Upgrade path: a `users.species_preference` column later — not now.)
- **Swipe** (`pages/SwipePage.tsx` + `components/SwipeDeck.tsx`) — segmented **All / Dogs / Cats** control above the deck; `all` = mixed deck (species badge on each card via `SwipeCard.tsx`); `dog`/`cat` = single‑species deck. Query key `['feed', species]`. Same filter applies to Explore (`ExplorePage.tsx`, `['explore-pack', species]`).
- **Dashboard / Rankings** (`pages/RankingsPage.tsx` and wherever "Top Dog" is surfaced today) — when filter = `all`, render **two crown widgets** (`['rankings','dog']` + `['rankings','cat']`); when filtered, render only that one.

### Pages & components
- **`pages/DogEditorPage.tsx` → `PetEditor`** — **species selector as the first field** (before "Breed type"); drives which breed list `BreedMultiSelect` fetches and which trait chips render; maps to `species` on the payload. Species‑aware title/toasts ("Add a Cat" / "Add a Dog").
- **`pages/DogDetailPage.tsx`** & **`marketing/PublicDogPage.tsx`** — species‑aware copy, emoji (🐕 / 🐈), illustration, and crown label ("Top Cat" / "Top Dog").
- **`pages/MyDogsPage.tsx` → `MyPets`** — lists all owned pets, grouped by species.
- **`components/flair/DogIllustration.tsx`** — add a **cat illustration set** (or a neutral set); choose by `pet.species` at every empty state (swipe, detail, rankings, public).
- **Copy pass** — species‑aware app titles ("Rate My Dog" → species‑aware); `DogProfileCard` "Rescue dog" → species‑aware.

### Marketing (the rebrand — 8 files)
`MarketingHome`, `About`, `Mission`, `News`, `Privacy`, `Terms`,
`MarketingLayout`, `PublicDogPage` — reposition "the dog app that gets rescues
adopted" → **"the app that gets cats and dogs adopted."** Copy + hero art only;
no structural change.

### Parks (species‑agnostic — decision #3)
No gating. (Option A: `dog_id`→`pet_id` on `park_checkins` / `playdate_rsvps`.)
Optionally surface the pet's species on attendee chips so we can later decide,
from real data, whether to gate parks to dogs. **No filter added now.**

---

## 7. Data: cat breeds & trait vocab

- **Cat breeds** — seed ~40–70 breeds from the CFA/TICA registries (Siamese,
  Maine Coon, Ragdoll, Bengal, British Shorthair, Sphynx, …) with
  `species='cat'`. Cat `group` can be null or a cat‑appropriate grouping
  (natural / hybrid / …). *(Deliverable: I can generate the seed list.)*
- **Trait vocab** — keep `DOG_TRAITS`/`CAT_TRAITS` in sync **front + back**
  (the existing "keep in sync with frontend" contract). Shared core + a few
  species‑specific each.
- **`mix_type`** — same 4 internal values, species‑specific labels only.

---

## 8. Migrations, seed & tests

**Migration 1 — discriminator + per‑species crowns (mandatory):**
- `add_column` `species` to `pets`, `breeds`, `weekly_winners` (server_default `'dog'`, then backfill existing rows).
- Add index on `breeds.species`.
- Drop `UNIQUE(week_bucket)` on `weekly_winners`; add `UNIQUE(week_bucket, species)`.
- All plain `add_column` — **no `ALTER TYPE`** (no enums exist).
- **Declare every new index/constraint in BOTH the model and the migration** — `tests/test_migration_model_sync.py` diffs alembic‑head against the models and will fail otherwise.

**Migration 2 — rename (Option A only):** `op.rename_table('dogs','pets')`,
`op.alter_column` for each `dog_id`→`pet_id`, and rename the FK constraints and
indexes. Isolated so Option B simply omits it.

**Seed (`seed.py`):** create 2–3 cats with cat breeds/traits so `make seed`
yields both species in dev.

**Tests (`tests/`):**
- Fixture `create_cat` helper.
- Feed + explore respect `?species=`; `all` returns mixed.
- **Breed‑species validation**: assigning a dog breed to a cat → 400.
- **Per‑species crowns**: two winners in the same week (one dog, one cat); `(week_bucket, species)` uniqueness holds; `get_pet_stats` ranks within species.
- Public page returns species; crown label by species.
- Migration↔model sync stays green.

---

## 9. Phased rollout (each independently shippable)

| Phase | What | Visible to users? | Size |
|-------|------|-------------------|------|
| **1 — Foundations** | Migration 1 + backfill; `species` on model/schema/serializer; breed species‑scoping + validation; per‑species crown schema + ranking loop. **(Option A rename runs here, first.)** Everything defaults to `'dog'`. | No — app still 100% dogs | **L** |
| **2 — Create & rate cats** | Species selector on the editor; cat breed seed; cat traits; swipe species filter + species badge; Explore filter. | **Yes** — users can add & swipe cats | **M–L** |
| **3 — Per‑species dashboard** | Top Cat widget alongside Top Dog; species filter wired to dashboard/rankings; crown labels by species. | Yes | **M** |
| **4 — Rebrand** | Marketing copy (8 files); cat illustration set; public share page; app titles/emoji; trait/mix labels. | Yes | **M** |
| **Future (not now)** | Cross‑species **royale** event mode; species beyond cat/dog in UI; optional `sex`/`size` fields; server‑side species preference; data‑driven decision on gating parks. | — | — |

Sequencing note: **if we rename (Option A), do it in Phase 1** — before Phase 2
writes new cat code on the old `dog` identifiers.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Rename is broad and near‑irreversible; touches public URLs | Do it early (Phase 1); redirect `/dogs/{id}`→`/pets/{id}`; lean on `test_migration_model_sync` + full suite; it's cheapest now in beta. |
| Species‑filtered feed is thin while few cats exist | Per‑species empty states ("No cats yet — be the first"); `all` (mixed) is the default so the deck is never empty. |
| Cat breed data quality | Seed from CFA/TICA; admin can curate via existing `/admin/breeds`. |
| Trait vocab drift front↔back | Single source per species; keep the existing sync contract + a test. |
| Backfill correctness | `server_default='dog'` + explicit backfill; assert no null species post‑migrate. |
| Public/SEO links break on rename | Keep `/dogs/{id}` serving (redirect), don't 404 shared cards. |
| Per‑species crown doubles the 10‑min winner job | Negligible (2× a cheap aggregate). |

---

## 11. Open decisions to confirm

1. **Internal rename `dogs`→`pets`?** — *Recommended: yes, Phase 1.* (§3)
2. **Species filter storage** — *Recommended: `localStorage` v1*, upgrade to a user column later. (§6)
3. **Swipe "All" behavior** — *Recommended: mixed deck* (species badge per card) vs. force a pick. (§6)
4. **Cat breed seed list** — I can generate a curated CFA/TICA list for review. (§7)
5. App name stays **Fetch**, copy = "cats and dogs" — assumed yes unless told otherwise. (§3)

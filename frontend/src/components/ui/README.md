# Fetchpawz UI conventions (Brand Book, Edition 2)

The one-page contract for styling app code. The brand book is the source;
this is how it lands in Tailwind. When in doubt, copy what a shared
component does — don't hand-roll.

## Colour: every colour has one job

The stock Tailwind palettes are re-pointed at the brand in
`tailwind.config.js`, so old classes already land on brand colours. Use the
names below in new code.

| Name | Hex | Job |
|---|---|---|
| `brand-500` / `orange-500` | #FF6A1F Ball Orange | Play: the primary button, the like, the mark, selected states |
| `navy` | #1C1F45 Leash Navy | Ink: text, outlines, the toy shadow |
| `gold-500` | #FFC233 Crown Gold | **Earned only**: crowns, ranks, this week's winners. Never decoration, never a sale |
| `pink-500` | #FF5C93 Forever Pink | **Rescue only**: a pet who needs a home, rescues, adoption |
| `green-500` | #22B07A Off-Leash Green | Real world: parks, verified, found, "I can help" |
| `biscuit` | #FFF2E3 | The page. `night` (#11132E) after dark |
| `danger-500` | #D0313D | Errors and destructive actions only. **A lost pet is not an error** |
| `gray-*` | navy ink scale | Muted ink: `text-gray-600` muted, `text-gray-500` meta |

Rules:
- **Navy on colour.** Text on any colour fill is `text-navy`. White on Ball
  Orange fails contrast — never `bg-brand-500 text-white`. (Danger solid is
  the one fill with white text.)
- **No gradients.** Flat fills only: `bg-brand-500`, `bg-white`, tints like
  `bg-brand-100`.
- Surfaces: page `bg-biscuit dark:bg-night` (the shell does this), panels
  `bg-white dark:bg-night-surface`, raised `dark:bg-night-raised`, hairline
  `border-gray-200 dark:border-white/10`. The `.surface` class is the panel.
- Ink: primary `text-navy dark:text-biscuit`, muted `text-gray-600
  dark:text-gray-300`, meta `text-gray-500 dark:text-gray-400`.
- Every light class needs its dark partner.

## Type

| Role | Classes |
|---|---|
| Page title (h1) | Bagel Fat One 28px — `<PageHeader>` (h1 is Bagel globally) |
| Calm title | `<PageHeader plain>` / `font-plain` — Lost & Found, security, errors |
| Section heading (h2) | `text-lg font-extrabold` — `<SectionHeader>` |
| Pet names, ranks, big numbers | `font-display` (Bagel), **24px and up** only |
| Card title | `text-base font-extrabold` |
| Body | `text-sm`/`text-[15px]` Figtree |
| Eyebrow / field label | `.eyebrow` / `.field-label` (11px caps) |
| Codes (tags, invites, hex) | `font-mono` (DM Mono) |

Bagel has one weight: never pair `font-display` with `font-bold`. Sentence
case everywhere. No exclamation marks in errors.

## Shape

- Radius: `rounded-lg` 10 (inputs, tiles) · `rounded-2xl` 20 (panels) ·
  `rounded-3xl` 28 (cards, sheets) · `rounded-full` (buttons, chips, avatars).
- **Objects you touch** (pet cards, swipe cards, interactive tiles) get a
  2–2.5px navy line and the toy shadow: `.toy`, `shadow-toy` (3px right, 4px
  down) or `<Card interactive>`. **Panels stay flat** (hairline, no shadow).
- Buttons sit on a navy ledge: `shadow-ledge`. Never soft glows.

## Buttons and links that look like buttons

`<Button variant size loading>` or, on a `<Link>`, the same classes:
`className="btn btn-primary"` · `btn-secondary` · `btn-ghost` · `btn-danger`
· `btn-rescue` (pink, rescue features only) · `btn-park` (green, parks and
"I can help") · sizes `btn-sm` / `btn-lg` · icon-only `btn-icon` · `btn-paper` (white in
both themes, for buttons on an orange or pink band).
Inline links: `.link` (navy, orange underline) or the deep link orange
`text-brand-700 dark:text-brand-400` (the brand book's link colour, AA on
white and Biscuit) — never Ball Orange (`brand-500`) text on a light ground.
`<textarea>` and `<select>`: `.field` (the `<Input>` look).
**One `btn-primary` per screen.**

## Chips, segments, badges

- Traits and filters: `.chip` (white, navy line, punched hole), picked
  `.chip chip-on` (orange), "add your own" `.chip chip-add`.
- One-of-a-few: `.seg` with children; the picked one gets `seg-on`
  (or `aria-selected`/`aria-pressed`).
- `<Badge variant>`: `success` verified/approved/found · `warning` pending ·
  `danger` suspended/urgent (never lost) · `info` · `neutral` · `brand` ·
  `gold` earned (#3 in Hamilton, Top Pet) · `rescue` needs a home ·
  `missing` a lost pet (navy, orange dot) · `review` held for review (dashed).
- Ranks: `<RankMedal rank>` (`components/brand`) — gold only for #1.

## Brand art (`components/brand`)

- `<Lockup>` mark + drawn wordmark; `<Wordmark>`; `PawMark` is the Crown Paw
  (`simple` below 24px). The name is drawn — never set "Fetchpawz" in a font
  as a logo.
- `<BrandIcon name>` — the 36 drawn icons (24 grid, 2px stroke, one bean).
  Use them for features, tabs, tiles and empty states. Lucide is fine for
  minor controls (chevrons, x, more) because it matches the grid and stroke.
- `<PetPortrait species breed seed>` — the 39-breed cast (artwork loads lazily
  from `portraitData.ts`; ids and tints in `portraitIndex.ts`), for a pet with no
  photo, marketing, and placeholders.
- `<Crown>` — the drawn crown (winners only).

### Flair — the cartouche, and where it goes

Each of these has one job and a budget. None of them ever appears in Lost &
Found.

- `<Accent name>` — accent marks. sparkle = a win (Home crown card, the #1
  podium step, the crown moment), burst = a tap landed, zzz = nothing yet.
  Three at most per composition.
- `<Sticker fill tilt>` — a die-cut Bagel pill with a white edge, slapped on
  the pet hero's bottom edge: crown (gold) › "Adopt me" › "Adopted!" (pink).
  It is the screen's one tilted thing, so one sticker per screen.
- `<Rosette title caption>` — the weekly crown made physical. Only in
  `<CrownMoment>`, the full-gold screen an owner sees once when last week's
  settled crown went to their pet (`crownMomentSeen` keys it per week + pet).
- `<Peek id>` — a cast portrait peeking over the top edge of its `relative`
  parent (Home's swipe card, the Explore sheet, the rescues band, marketing
  sections). Give it room above: it sits outside the parent.
- `<TailRule>` closes a long page (Home); `<TailUnderline>` underlines one
  phrase in a headline (marketing hero, Donate). The tail is used once per
  view, besides the wordmark's own.
- `.toybox-biscuit|navy|orange|pink` — the pattern, for the insides of
  things: the splash, a band, a cover. Bagel at 36px+ may sit on it; anything
  smaller sits on a plain plate (`bg-navy` / `bg-white` / the fill colour).
- `<Splash>` — the orange toy-box screen while the session wakes
  (`AuthGuard`); it waits ~180ms before fading in so a fast boot never flashes.

### Beyond the book (same spirit, new moments)

- `<PetWeekCard>` (Home) — where *your* pet stands in this week's race: the
  gap to the crown on an orange track with the crown as a navy line at the
  finish (gold only once it's won). Rank comes from the live board's order,
  which breaks ties the way the crown does. A pet with no approved photo isn't
  in the deck, and the card says so and offers the fix instead of a rank.
- Occasions (`utils/occasions.ts`) — birthdays (orange) and homecomings, the
  anniversary of `adopted_at` (pink: adoption). `<OccasionCard>` on the
  owner's Home, a sticker on the profile (a birthday outranks the crown for
  its one day), and a ring on the Following strip.
- The reunion — a resolved missing-pet report gets a flat green "is home
  safe" plate, in-app and on the public share page, and everyone who sent a
  sighting gets a `lost_reunited` inbox note. Still the calm register: plain
  type, no exclamation, no flair.

## The calm register (Lost & Found)

Missing pets get plain type: `<PageHeader plain>`, Figtree only, flat cards,
no tilt, no toy shadow, no doodles, no jokes, no exclamation marks. Missing =
`<Badge variant="missing">`; found/sighting/"I can help" = green. Never
danger red. Pins sit inside a privacy circle, never on a house.

## No emoji in UI

No emoji in labels, headings, buttons, tiles, toasts or empty states — they
render differently on every phone and can't take our colours. Use a
`<BrandIcon>` or nothing. (A push notification may carry one.)

## States

- Loading: grids → `CardSkeleton` · row lists → `ListSkeleton` · full-page
  and maps → `PawSpinner` (the paw-step beans)
- Photos: `className="photo-in"` + `ref={photoIn}` (`utils/photoIn.ts`) on a
  pet photo's `<img>`, inside a frame with a tint (`bg-brand-100
  dark:bg-night-raised`). It fades in once decoded instead of popping in;
  `PetPhoto` already does this. Not on an `<img>` that carries its own
  background or border — those would fade too.
- Empty: `<EmptyState illustration=…>` — a doodle, one bold line, one plain
  line, one button. sleeping = nothing yet · sniffing = nothing found ·
  ball = success · digging = error/404 · howling = alerts
- Error: `<ErrorState onRetry>`
- Toasts: navy, bottom, four seconds. What happened first, what it means
  second.

## Motion

- Ease `ease-soft-out` for UI, `ease-bounce` for game objects only.
- `animate-wag` on a like (the deck's Like heart), `animate-crown-drop` once a
  week for winners, `animate-tail-wag` is the logo's own move — on load in the
  headers, and on hover of any `group/logo` ancestor.
- Celebrations: `usePawBurst()`; it no-ops under reduced motion.

## Component index

`Button` `Input` `PasswordInput` `SearchInput` `Badge` `Card`
`PageHeader` `SectionHeader` `BackButton` `Avatar` `EmptyState`
`ErrorState` `Skeleton`/`CardSkeleton`/`ListSkeleton` `PawSpinner`
`PaginationFooter` `BreedMultiSelect` `PawMark` — flair:
`DogIllustration` `PawBurst` `BoneProgress` `PawTrail` — toasts:
`appToast` from `src/utils/appToast`.

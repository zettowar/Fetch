# Fetch UI conventions

The one-page contract for styling app code. When in doubt, copy what a
shared component does — don't hand-roll.

## Type scale

| Role | Classes |
|---|---|
| Page title (h1) | `text-2xl font-bold tracking-tight` (use `<PageHeader>`) |
| Section heading (h2) | `text-lg font-bold tracking-tight` (use `<SectionHeader>`) |
| Card title | `text-base font-semibold` |
| Body | `text-sm` |
| Meta / captions | `text-xs text-gray-500 dark:text-gray-400` |
| Micro (badge counts) | `text-2xs` |

No arbitrary sizes: `text-[10px]`/`text-[11px]` → `text-2xs`, `text-[13px]`
→ `text-xs`, `text-[15px]` → `text-sm`/`text-base` by role.

## Radius, padding, shadows

- Cards & sheets `rounded-2xl` · inputs & md buttons `rounded-xl` · sm
  buttons `rounded-lg` · pills/avatars/icon buttons `rounded-full`
- Card padding steps: `p-3` dense · `p-4` default · `p-5` roomy (the
  `<Card padding>` prop)
- Shadows: resting `shadow-soft-sm` · hover/elevated `shadow-soft` ·
  overlays `shadow-soft-lg` · brand CTA hover `shadow-brand-glow`.
  `shadow-md` is deprecated in app code.

## Semantic colors

`success` (emerald), `warning` (amber), `danger` (red), `info` (sky) are
full palette aliases in tailwind.config.js. Recipes:

- Solid: `bg-{tone}-500 text-white` (hover `-600`, active `-700`)
- Tint (badges, banners): `bg-{tone}-100 text-{tone}-700
  dark:bg-{tone}-500/15 dark:text-{tone}-300` (warning uses `-800` light)
- Border accent: `border-{tone}-200 dark:border-{tone}-500/30`

New code uses semantic names; migrate raw `red/amber/emerald/sky` classes
only when touching a file anyway.

## Icons (lucide-react)

- Named imports only: `import { Bell } from 'lucide-react'`
- Sizes: inline with text / inside buttons `16` · top-bar 32px icon
  buttons `18` · tab bar `26` (strokeWidth 2; 2.5 + `fill="currentColor"`
  when active)
- Icons are always `aria-hidden`; the accessible name lives on the parent.
- Emoji stays only for personality: copy, celebrations, marketing.

## States

- Loading: grids → `CardSkeleton` · row lists → `ListSkeleton` · maps →
  `PawSpinner` in a floating `.glass` pill · full-page → `PawSpinner`
- Empty: `<EmptyState illustration=…>` — sleeping = nothing yet ·
  sniffing = search found nothing · ball = liked/social · digging =
  lost & found / 404 · howling = alerts
- Error: `<ErrorState onRetry>` (digging dog by default)

## Badges

`<Badge variant>` semantics: success = active/approved/verified ·
warning = pending/attention · danger = urgent/suspended/lost ·
info = informational · brand = traits/features · neutral = everything else.

## Motion

- Tappable cards: `<Card interactive>` (or `hover-lift pressable`)
- Icon buttons: `active:scale-95`
- Celebrations: `usePawBurst()` — fire on likes/wins/creations; it
  no-ops under reduced motion automatically.
- All CSS keyframes are neutralized globally by the reduced-motion rule
  in index.css; gate JS-driven framer loops on `useReducedMotion()`.

## Component index

`Button` `Input` `PasswordInput` `SearchInput` `Badge` `Card`
`PageHeader` `SectionHeader` `BackButton` `Avatar` `EmptyState`
`ErrorState` `Skeleton`/`CardSkeleton`/`ListSkeleton` `PawSpinner`
`PaginationFooter` `BreedMultiSelect` `PawMark` — flair:
`DogIllustration` `PawBurst` `BoneProgress` `PawTrail` — toasts:
`appToast` from `src/utils/appToast`.

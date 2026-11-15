/* Generated from the Fetchpawz Brand Book, Edition 2 (Shapes → Accent marks).
 * The little drawn marks that sit around objects when something happens. Same
 * hand as the doodles. Orange on light, Biscuit on Navy, Navy on Orange; three
 * at most in one composition, and none in Lost & Found. */

export const ACCENTS = {
  sparkle: { viewBox: "0 0 48 48", svg: "<path d=\"M24 4c2.400 12 8 17.600 20 20-12 2.400-17.600 8-20 20-2.400-12-8-17.600-20-20 12-2.400 17.600-8 20-20Z\" fill=\"currentColor\"/>" },
  burst: { viewBox: "0 0 48 48", svg: "<path d=\"M12 36 5 41M10 24H2M14 13 8 6M26 9V1M37 13l6-7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\"/>" },
  zoom: { viewBox: "0 0 48 48", svg: "<path d=\"M6 14h26M14 24h28M6 34h20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\"/>" },
  heart: { viewBox: "0 0 48 48", svg: "<path d=\"M24 41C10 32 4 25 4 16.500 4 10 9 6 14.500 6c4 0 7.500 2.300 9.500 5.800C26 8.300 29.500 6 33.500 6 39 6 44 10 44 16.500 44 25 38 32 24 41Z\" fill=\"currentColor\"/>" },
  zzz: { viewBox: "0 0 48 48", svg: "<path d=\"M6 30h10L6 42h10M20 16h12L20 30h12M34 4h10L34 14h10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.500\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" },
  arcs: { viewBox: "0 0 48 48", svg: "<path d=\"M8 36q8-8 6-18M20 42q14-12 12-30M32 46q16-16 13-40\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.500\" stroke-linecap=\"round\"/>" },
  squiggle: { viewBox: "0 0 48 48", svg: "<path d=\"M4 28c4-12 8-12 12 0s8 12 12 0 8-12 12 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" },
  tail: { viewBox: "0 0 64 44", svg: "<path d=\"M3 5h26c18 0 26 13 18 25-3 5-9 6-13 2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\"/><circle cx=\"34\" cy=\"32\" r=\"6.500\" fill=\"var(--orange)\"/>" },
} as const;

export type AccentName = keyof typeof ACCENTS;

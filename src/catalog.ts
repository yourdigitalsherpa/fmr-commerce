/**
 * The Fourth Man Roasters catalogue.
 *
 * Two single-origin micro-lots, four roasts, four weights: 32 Shopify variants.
 * This matrix was byte-identical across all seven white-label repos, which meant
 * a price change or a new roast was seven separate edits and any missed one
 * shipped a wrong price or a dead variant. It lives here now.
 *
 * Per-partner presentation (bag photography, origin story, badges, mission
 * note) deliberately does NOT live here — that is each label's own brand.
 */

export const ROAST_LEVELS = ['Light', 'Medium', 'Dark', 'Espresso'] as const;
export type Roast = (typeof ROAST_LEVELS)[number];

export const WEIGHTS = ['1 lb', '2 lb', '5 lb', '20 lb'] as const;
export type Weight = (typeof WEIGHTS)[number];

export type OriginSlug = 'zambia' | 'uganda';

/**
 * Whole bean or ground at the mill.
 *
 * The store has carried this axis all along, as a third product option, which
 * means 32 variants per origin rather than 16. Until 2026-08-07 this package
 * only ever held the Whole half, so every white-label could sell exactly half
 * the catalogue and nobody noticed. Ground costs the same as whole.
 */
export const GRINDS = ['Whole', 'Ground'] as const;
export type Grind = (typeof GRINDS)[number];

export type CatalogVariant = {
  weight: Weight;
  /** USD, as a string, exactly as Shopify lists it. */
  price: string;
  /** Roast -> 14-digit Shopify variant id, whole bean. */
  ids: Record<Roast, string>;
  /** The same cells, ground at the mill. Same price. */
  groundIds: Record<Roast, string>;
};

export type CatalogOrigin = {
  slug: OriginSlug;
  /** The origin's own name. Partners may re-title it in their own copy. */
  name: string;
  variants: CatalogVariant[];
};

export const CATALOG: readonly CatalogOrigin[] = [
  {
    slug: 'zambia',
    name: 'Zambia',
    variants: [
      { weight: '1 lb', price: '17.95',
        ids: { Light: '48509234938110', Medium: '48586864197886', Dark: '48586864230654', Espresso: '48586938188030' },
        groundIds: { Light: '48687832072446', Medium: '48687832105214', Dark: '48687832137982', Espresso: '48687832170750' } },
      { weight: '2 lb', price: '35.90',
        ids: { Light: '48509234970878', Medium: '48586864263422', Dark: '48586864296190', Espresso: '48586938220798' },
        groundIds: { Light: '48687832203518', Medium: '48687832236286', Dark: '48687832269054', Espresso: '48687832301822' } },
      { weight: '5 lb', price: '89.75',
        ids: { Light: '48509235003646', Medium: '48586864328958', Dark: '48586864361726', Espresso: '48586938253566' },
        groundIds: { Light: '48687832334590', Medium: '48687832367358', Dark: '48687832400126', Espresso: '48687832432894' } },
      { weight: '20 lb', price: '359.00',
        ids: { Light: '48509235036414', Medium: '48586864394494', Dark: '48586864427262', Espresso: '48586938286334' },
        groundIds: { Light: '48687832465662', Medium: '48687832498430', Dark: '48687832531198', Espresso: '48687832563966' } },
    ],
  },
  {
    slug: 'uganda',
    name: 'Uganda',
    variants: [
      { weight: '1 lb', price: '17.95',
        ids: { Light: '48509235069182', Medium: '48586864886014', Dark: '48586864918782', Espresso: '48586938384638' },
        groundIds: { Light: '48687832695038', Medium: '48687832727806', Dark: '48687832760574', Espresso: '48687832793342' } },
      { weight: '2 lb', price: '35.90',
        ids: { Light: '48509235101950', Medium: '48586864951550', Dark: '48586864984318', Espresso: '48586938417406' },
        groundIds: { Light: '48687832826110', Medium: '48687832858878', Dark: '48687832891646', Espresso: '48687832924414' } },
      { weight: '5 lb', price: '89.75',
        ids: { Light: '48509235134718', Medium: '48586865017086', Dark: '48586865049854', Espresso: '48586938450174' },
        groundIds: { Light: '48687832957182', Medium: '48687832989950', Dark: '48687833022718', Espresso: '48687833055486' } },
      { weight: '20 lb', price: '359.00',
        ids: { Light: '48509235167486', Medium: '48586865082622', Dark: '48586865115390', Espresso: '48586938482942' },
        groundIds: { Light: '48687833088254', Medium: '48687833121022', Dark: '48687833153790', Espresso: '48687833186558' } },
    ],
  },
];

/**
 * How each weight physically arrives.
 *
 * Andrew, 2026-08-06: "It exists but we ship them as four 5lb bags." The 20 lb
 * line is not a 20 lb sack and never was — the roaster does not bag that size.
 * Sites were calling it a "case", which reads like one container and sets the
 * wrong expectation at the door.
 *
 * Read this rather than writing the sentence per repo, the same reason prices
 * live here. Note it says nothing about per-pound price: since 2026-08-03 every
 * size is $17.95/lb, so no page may pitch a larger size as cheaper per pound.
 */
export const WEIGHT_FORMATS: Record<Weight, string> = {
  '1 lb': 'One 1 lb bag',
  '2 lb': 'One 2 lb bag',
  '5 lb': 'One 5 lb bag',
  '20 lb': 'Four 5 lb bags',
};

/** Espresso is a medium-dark roast, not a bean. Sites that show roast guidance say so. */
export const ROAST_NOTES: Record<Roast, string> = {
  Light: 'Roasted brightest. The most origin character in the cup.',
  Medium: 'The everyday middle. Balanced, round, dependable.',
  Dark: 'Longer in the roaster. Deep, bittersweet, heavy.',
  Espresso: 'A medium-dark roast built to hold up under pressure.',
};

export function getOrigin(slug: OriginSlug): CatalogOrigin {
  const found = CATALOG.find((o) => o.slug === slug);
  if (!found) throw new Error(`[@fmr/commerce] unknown origin: ${slug}`);
  return found;
}

/**
 * The Shopify variant id for one origin / weight / roast / grind.
 *
 * `grind` is last and defaults to 'Whole' so the seven sites that call this
 * with three arguments keep resolving to exactly the variant they resolved to
 * before. Do not reorder these parameters.
 */
export function variantId(
  slug: OriginSlug,
  weight: Weight,
  roast: Roast,
  grind: Grind = 'Whole'
): string {
  const v = getOrigin(slug).variants.find((x) => x.weight === weight);
  if (!v) throw new Error(`[@fmr/commerce] unknown weight "${weight}" for ${slug}`);
  return grind === 'Ground' ? v.groundIds[roast] : v.ids[roast];
}

# @fmr/commerce

The shared commerce layer for every Fourth Man Roasters white-label coffee site.

## Why this exists

The white-label sites were built by **forking each other**. That meant every
improvement only ever travelled *forward* to whatever got forked next, and the
designated fork bases were the oldest repos. By 2026-07-27 the measured damage
was:

- **Three live sites** offered "Subscribe & save 5%" and displayed the
  **undiscounted price**. The saving was invisible at the point of decision.
- The newest site shipped with a buy box **three generations old**, because it
  was forked from the oldest one.
- The **32-variant catalogue was duplicated seven times**, byte-identical. A
  price change was seven edits, and a missed one meant a wrong price or a dead
  variant in production.
- Selling-plan ids had changed upstream before and left shipped sites linking a
  **dead `selling_plan`**.

None of that is a mistake anyone made. It is what copy-paste distribution does
over eight repos. This package is the fix: the things that are true of *the
store* live in one place, and a fix lands once.

## What belongs here

| In | Out |
|---|---|
| Store domain, selling plans, discount | Partner name, rep slug |
| The 32-variant catalogue and prices | Bag photography, origin story, badges |
| `buyUrl` attribution mechanics | Palette, type, layout, copy |
| Pricing / discount math | Anything a partner would call "our brand" |

If you find yourself wanting to put a partner's colour or sentence in here, that
is the signal that it belongs in that partner's repo instead.

## Install

These are separate repos with no npm registry auth, so install straight from
GitHub:

```bash
npm i github:yourdigitalsherpa/fmr-commerce
```

The package ships **raw TypeScript** (no build step, no committed `dist`), so
Next.js must be told to transpile it:

```ts
// next.config.ts
const nextConfig = {
  transpilePackages: ['@fmr/commerce'],
};
```

To pick up a later fix:

```bash
npm update @fmr/commerce && npm run build && vercel --prod
```

## Use

```ts
import { CATALOG, buyUrl, priceFor, SELLING_PLANS } from '@fmr/commerce';

const ATTRIBUTION = { partner: 'SHPRD Coffee Roasters', rep: 'cameron' };

// price the buyer should actually see
const view = priceFor('17.95', planId);
view.display;         // "17.05" when subscribed
view.original;        // "17.95" -> render struck through
view.cadence;         // "every month"
view.discountPercent; // 5

// checkout
const href = buyUrl(variantId, ATTRIBUTION, { sellingPlanId: planId });
```

### The attribution trap

`partner` **must byte-match** a key in
`kch/scripts/shopify/registry.json` → `labels`. If it does not, orders still
succeed and the payout report attributes **nothing**. There is no error to see.
Add the partner to the registry in the same change that adds the site.

### Never index into `SELLING_PLANS`

Key by `id`. The array has changed length upstream before and an out-of-bounds
index crashed sibling buy boxes on subscribe. `findPlan(id)` is provided for
exactly this.

## Verifying against the live store

Selling plans and variant ids drift on the Shopify side without telling anyone:

```bash
node c:/dev/kch/scripts/shopify/selling-plans.mjs
```

If the plan list changes, update `src/store.ts` here and every site picks it up
on its next `npm update` — instead of eight hand edits, seven of which get done.

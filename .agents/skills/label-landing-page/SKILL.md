---
name: label-landing-page
description: Add or audit Landing Optimizer data-lo-role and data-lo-id attributes on an existing website, landing page, or CMS template. Use for manual page mapping and tracking labels; preserve the site's design and behavior.
---

# Label a website for Landing Optimizer

Add stable instrumentation attributes to the site's actual templates/components.
The SDK reads `data-lo-role`, not generic `data-role` or the accessibility `role`
attribute. Do not rename or overwrite unrelated attributes the site already uses.

Read [the labeling contract](references/labeling-contract.md) before editing. It
contains the ten accepted roles, examples, selector rules and SDK lifecycle limits.
It is bundled so this skill can be copied to another website repository.

## Inspect and map the page

Find the real rendered routes, shared components, responsive duplicates and SDK
initialization. Identify the navigation, hero, relevant headings, every CTA, forms,
pricing, proof, FAQ, remaining meaningful sections and footer that actually exist.
Do not invent sections to fill the vocabulary. Review existing labels and active
goal/experiment selectors before changing identities.

Any `data-lo-role`, even an invalid or ignored one, activates manual mapping for
the entire document. There is no automatic fill-in. Label the complete intended
tracking surface of each changed page, especially all CTAs and forms, before it
goes live. An ID alone does not activate manual mode.

## Apply the smallest complete change

- Add both attributes to each mapped element. Keep the existing layout, copy,
  CSS, DOM order, links, form behavior and accessibility semantics.
- Use these exact roles: `navigation`, `hero`, `heading`, `cta`, `form`, `pricing`,
  `testimonials`, `faq`, `section`, `footer`. One role per element.
- Put `hero` on its container, `heading` on a small copy target, `cta` on the
  actual clickable element and `form` only on a real `<form>`, not its fields.
- IDs follow `^[a-z][a-z0-9-]{0,63}$`. Choose semantic identities such as
  `hero-headline`, `hero-signup`, `pro-plan-signup` and `lead-form`. Keep them stable
  across copy/style changes; avoid array positions, random IDs and generated CSS.
- IDs must be unique across the entire rendered document, including unmarked,
  hidden and desktop/mobile copies. Use distinct stable suffixes for duplicates.
  For shared components, pass an explicit static identity using the site's existing
  prop conventions and ensure it reaches the DOM. Do not add a new wrapper system.
- Keep at most 60 valid mapped elements per page. Favor meaningful targets over
  labeling every nested container; do not claim excess nodes will reach the API.
- Exclude sensitive subtrees with `data-lo-ignore`. Never put personal data,
  account IDs, email addresses or tokens in identities or mapped copy. Attributes
  are not a consent system, and unmarked elements are not generally excluded from
  page-level/dead-click/rage-click collection.
- Labels must exist before SDK tracking initializes. Do not inject them after load
  or promise support for SPA navigation, late-mounted content, iframes or shadow DOM
  without verifying an appropriate lifecycle/integration. Report gaps rather than
  inventing a remapping API.

## Validate in the rendered page

Run [scripts/validate-labels.js](scripts/validate-labels.js) in the browser context
of each changed page, including desktop/mobile variants and relevant UI states.
It is a read-only expression returning `manualMode`, `mappedCount`, `errors`,
`warnings` and safe node identities. With Playwright, read the file and pass its
contents to `page.evaluate`; it requires no browser dependency or SDK global.

Resolve errors and inspect warnings. The validator checks rendered markup, not
semantic completeness, consent, SDK initialization, persistence or actual tracking.
Inspect the page too: all intended CTAs/forms must be labeled, interactions and
keyboard access must still work, and no sensitive content should be mapped.

When a compatible SDK/API and an authorized staging environment are available,
reload after editing and inspect actual network payloads for page-map selectors,
CTA click, form focus/native submit and section visibility. Use only test inputs;
do not submit real customer forms or create real leads for validation. Verify that
selectors persist server-side when access permits. Do not treat a 202 alone as
proof that selectors survived sanitization.

Use exact standalone selectors such as `[data-lo-id="hero-signup"]` for experiments.
Label a text-only target when `set_text` may be used, because it replaces children.
Attributes do not create business conversions: preserve existing success handling
and call `LandingOptimizer.conversion(...)` only after a confirmed outcome when
that integration is actually requested.

The API must support these selectors before the labeled SDK is deployed. Keep
installation keys, origin allowlists, SDK upgrades, deployment and experiment
publication within the user's authorized scope. Reuse the site's own generated
installation snippet; never copy another tenant's configuration.

## Hand off

Report the changed routes/components, role/ID inventory, validation performed and
any SDK, dynamic-content, privacy or rollout gaps. Flag existing goals/experiments
that still use old selectors: labels do not migrate historical analytics or targets.
Keep unverified integration checks explicit. Do not commit or push unless the
target repository and the user authorize it.

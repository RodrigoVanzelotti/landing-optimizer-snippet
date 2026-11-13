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

## Default to low-friction CMS installation

Assume the customer may only have access to a CMS/editor and a head-code or GTM
slot, with no repository, backend access or ability to add customer-specific JS.
Prefer the generated installation snippet plus static `data-lo-role`/`data-lo-id`
attributes exposed by the editor. Do not require a new locally hosted loader,
theme edits, custom success callbacks or a platform plugin as the default setup.
The SDK also reads configuration directly from its script tag; verify whether
the installation UI exposes that format rather than assuming it generates it.

Check what the published site actually permits: executing the SDK on the main
document, saving custom attributes, native form submissions, success redirects,
late-rendered elements and navigation without a full reload. An HTML embed in an
isolated iframe is not equivalent to a script installed in the parent page.
CMS names alone do not establish compatibility; test the customer's actual editor,
permissions, published DOM and workflow. Do not invent access or a platform adapter.

For conversions without custom code, prefer an existing success-page URL when it
signals the intended outcome; otherwise offer native form submissions explicitly
as attempts. A confirmed-success event callback is an optional advanced integration,
appropriate when the site exposes one and the user authorizes it. If neither a
success URL nor a supported success signal exists, report that confirmed business
success cannot yet be measured; never relabel a click/attempt as confirmed success.
For a site we own, a custom callback can demonstrate that advanced path, but it
must not become a requirement for installing the product on customer sites.

Where the editor cannot save labels, the SDK's existing heuristic discovery is
available only on pages without any role attributes. Remote selector-to-role/ID
mapping, configurable success-element detection, CMS-specific success adapters and
SPA remapping are not supplied by this labeling skill. Check current SDK support
and report any missing capability instead of injecting per-customer JS to hide it.

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

After changing a page, explicitly return a **Conversion goals to add in the
dashboard** list, even if no new goals are needed. Labels map elements and track
interactions; they do not define business success or create dashboard goals.

- Identify the page's intended business outcome and recommend it as the primary
  goal. List intermediate actions only as optional diagnostics, not equivalent
  conversions. Do not turn every labeled CTA, navigation link or demo control
  into a goal; CTA clicks are already interaction events.
- For each recommendation, give the exact dashboard `Name`, `Kind`, matcher
  fields (selector or URL operator/path when applicable), trigger, and readiness:
  already instrumented, integration required, or runtime support unverified.
  Distinguish goals to add from existing goals to keep/update; do not suggest
  duplicate goals for unchanged identities.
- Inspect the current dashboard/API contract when available. The current kinds
  are `event`, `url` and `form_submit`; `cta` is a mapping role, not a goal kind.
  Verify runtime evaluation as well as accepted configuration. A goal being
  saved successfully does not prove its matcher generates conversions.
- An `event` goal's name must exactly match
  `LandingOptimizer.conversion("name")`. Prefer a stable ASCII name of at most
  64 characters, the SDK limit. Confirm the call exists after business success;
  otherwise explicitly state the missing integration and where it belongs.
  Do not add that integration unless requested, and do not require it for the
  default CMS setup; recommend a supported no-code signal when one exists.
- For `form_submit`, use the actual mapped form's exact standalone selector,
  e.g. `[data-lo-id="lead-form"]`. Native submission is an attempt, not proof
  of successful persistence/payment. For `url`, use an actual success pathname
  and the supported matcher; an anchor such as `#contact` is not a success page.
- With the updated API, matching `page_view` and `form_submit` events generate
  conversions at ingestion for their configured goals. Keep business success
  separate from submission attempts. These rules apply to incoming events after
  configuration; creating a goal does not backfill past visits/submissions.
- State which goal to select as the experiment's primary goal before review.
  The dashboard's experiment detail page supports this on drafts/AI suggestions.
  Results count one converted session per variant after exposure, filtered by
  that goal; without a primary goal they include all conversion goals. Session
  attribution uses the SDK session identity with the API's daily privacy salt.
  Optional diagnostic goals can increase the site's aggregate conversion count;
  do not recommend adding one unless that additional metric is useful.
- Check old selectors and SDK/API compatibility. If runtime support cannot be
  verified, keep the recommendation conditional and state the check remaining.
  Do not create goals in a connected account without user authorization.

Report the changed routes/components, role/ID inventory, validation performed and
any SDK, dynamic-content, privacy or rollout gaps. Flag existing goals/experiments
that still use old selectors: labels do not migrate historical analytics or targets.
Keep unverified integration checks explicit. Do not commit or push unless the
target repository and the user authorize it.

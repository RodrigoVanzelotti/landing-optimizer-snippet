> Contract snapshot verified against the Landing Optimizer SDK and API on 2026-11-12.
> Source: landing-optimizer-snippet/docs/CLIENT_LABELING.md. If a different SDK version is used, verify compatibility before applying labels.

# Client website labeling

Use dedicated HTML attributes, not CSS classes. Labels must be present before
the snippet initializes. Put them in the client's templates, components or CMS;
labels added only in browser developer tools disappear on reload.

## Attribute contract

| Attribute | Meaning and accepted values |
| --- | --- |
| `data-lo-role` | One exact lowercase role from the table below. One role per element. |
| `data-lo-id` | Stable identity, unique across the entire document, including hidden/mobile copies. Starts with a lowercase ASCII letter; remaining characters are lowercase letters, digits or hyphens; maximum 64 characters. Values resembling personal information are rejected. Use descriptive names such as `hero-signup`, never visitor/account IDs. |
| `data-lo-ignore` | Presence excludes the element and its descendants from mapping, hover and click/form handlers; also removes the subtree from snapshot images. Put it on sensitive areas. It does not disable page-level engagement events. |

Every manually mapped element needs **both** role and ID. The snippet does not
add or repair labels. Unknown roles, missing/malformed/PII-shaped IDs, duplicate
IDs and ignored elements are skipped. A duplicate ID anywhere in the document
invalidates that identity, even if the other element is unmarked or hidden.

**Any `data-lo-role` anywhere on the page enables manual mapping for that page.**
Only valid labeled elements enter its page map; there is no automatic fill-in
for missing roles. Even an invalid role activates manual mode, so validate labels
before deployment. Pages with no role attributes retain heuristic discovery.
`data-lo-id` alone does not enable manual mapping.

## What to label

| `data-lo-role` | Apply to | Example `data-lo-id` |
| --- | --- | --- |
| `navigation` | Main navigation container; optionally separate secondary navigation. | `main-navigation` |
| `hero` | Introductory section container, rather than the headline itself. | `main-hero` |
| `heading` | Each headline/subheadline whose copy should be analyzed or tested. Prefer the smallest text-only element; native h1–h3 tags are not required. | `hero-headline`, `hero-subheadline`, `pricing-headline` |
| `cta` | Each actual action link/button, including repeated hero, navigation, plan and footer CTAs. Mark the clickable element, not its section or inner icon. Use native links/buttons for accessibility. Submit inputs are supported. | `hero-signup`, `nav-demo`, `pro-plan-signup` |
| `form` | The actual `<form>` element. A div labeled as a form is rejected. Do not label individual fields. | `lead-form` |
| `pricing` | Each pricing section/table or plan card you want separately measured. Use separate IDs if labeling both a container and its cards. | `main-pricing`, `pro-plan` |
| `testimonials` | Social-proof section, review strip, customer-logo strip, or individual testimonial card to analyze separately. | `customer-proof`, `review-acme` |
| `faq` | FAQ section or individual question/answer block to analyze separately. | `main-faq`, `faq-cancellation` |
| `section` | Other relevant content: benefits, features, process, guarantees, or a small copy block that needs its own identity. | `benefits`, `how-it-works`, `guarantee-copy` |
| `footer` | Footer container. Label its CTA separately if applicable. | `main-footer` |

Multiple elements may share a role, but never an ID. Reuse an ID across visits
and copy changes for the same logical element. It may be reused on a different
page because page maps are scoped by pathname. Desktop/mobile duplicates on the
same page need different IDs, such as `hero-signup-mobile` and
`hero-signup-desktop`. Hidden elements may enter the map; visibility and snapshot
geometry depend on actual rendering.

## Example

```html
<nav data-lo-role="navigation" data-lo-id="main-navigation">
  <a href="/demo" data-lo-role="cta" data-lo-id="nav-demo">Agendar demo</a>
</nav>

<section data-lo-role="hero" data-lo-id="main-hero">
  <h1 data-lo-role="heading" data-lo-id="hero-headline">Seu próximo passo</h1>
  <p data-lo-role="heading" data-lo-id="hero-subheadline">Comece com confiança.</p>
  <a href="/cadastro" data-lo-role="cta" data-lo-id="hero-signup">Começar</a>
</section>

<section data-lo-role="pricing" data-lo-id="main-pricing">
  <h2 data-lo-role="heading" data-lo-id="pricing-headline">Planos</h2>
  <article data-lo-role="pricing" data-lo-id="pro-plan">
    <p>Plano Pro</p>
    <a href="/cadastro/pro" data-lo-role="cta" data-lo-id="pro-plan-signup">Assinar</a>
  </article>
</section>

<section data-lo-role="testimonials" data-lo-id="customer-proof">...</section>
<section data-lo-role="faq" data-lo-id="main-faq">
  <details data-lo-role="faq" data-lo-id="faq-cancellation">
    <summary>Posso cancelar?</summary><p>Sim, a qualquer momento.</p>
  </details>
</section>
<section data-lo-role="section" data-lo-id="benefits">...</section>
<form data-lo-role="form" data-lo-id="lead-form">
  <label>E-mail <input type="email" name="email"></label>
  <button type="submit" data-lo-role="cta" data-lo-id="lead-submit">Enviar</button>
</form>
<aside data-lo-ignore>Private account details</aside>
<footer data-lo-role="footer" data-lo-id="main-footer">...</footer>
```

## What these labels track

- **All valid mapped roles:** short page-map text/hash, section visibility at 40%
  intersection, hover attention, and geometry during optional snapshot capture.
  Map text is up to 80 characters of normalized `textContent`, potentially
  including descendants/hidden text. Label smaller copy blocks when needed.
- **CTA:** `cta_click` for the marked action, including clicks on its descendants,
  regardless of language, URL or styling. On manual pages, unmarked buttons do
  not generate CTA events. Custom clickable elements can be labeled, but their
  behavior and keyboard accessibility remain the client's responsibility.
- **Form:** first observed focus emits `form_start`; a native DOM submit emits
  `form_submit`. Only mapped forms are tracked in manual mode. Field values are
  not read. A button click alone is not a submission or a successful conversion.
- **Page-level behavior:** page views, scroll, dwell and dropoff continue.
  Dead/rage clicks can still describe unmarked elements; labels are not a
  general collection allowlist. Use `data-lo-ignore` for sensitive subtrees.
- **Business outcomes:** attributes do not infer conversions. Call
  `LandingOptimizer.conversion("signup")` after confirmed success, or configure
  the appropriate business goal separately.

IDs produce selectors such as `[data-lo-id="hero-signup"]` consistently for
mapping, CTA/form events, hover, visibility, snapshots and experiment targeting.
`section_view` includes the role in `sec` and the element selector in `sel`.
Roles alone are not identities. Existing role-based aggregate reports may still
combine repeated sections; this change supplies selectors, not new dashboards.
Experiment selectors must use the exact standalone ID selector (double quotes);
general attribute selectors, role selectors and attribute-selector chains remain
blocked. Label text-only experiment targets: `set_text` replaces their children.
An input's displayed `value` is not collected as page-map text.

## Rollout and limits

1. Deploy the API selector-allowlist update **before** the new snippet. Older
   APIs discard these attribute selectors from maps/events/snapshots and reject
   them in experiment creation. No database migration or new wire fields are needed;
   `section_view.sel` was already optional in schema v1.
2. Deploy the snippet, then add and verify the complete set of client labels.
   Keep each page at **60 mapped elements or fewer** so every element reaches
   the API/AI. Mapping is in DOM order; internally only the first 120 are retained,
   and only the first 60 are transmitted. Manual CTA detection has no 25-CTA cap.
3. Check ID uniqueness and spelling, ignored areas, page-map nodes, one CTA click,
   form focus/submit and a section view in the browser network payloads. Verify
   persisted selectors and a draft experiment on a staging client page.
4. Labels must exist at initialization. There is no automatic SPA navigation,
   late-content remapping or continuous registration. Full-page navigation works;
   dynamically mounted content requires a separate lifecycle solution.

Attribute IDs change selector identity relative to older ID/class/path selectors.
Historical selector-specific reports/goals/experiments do not automatically merge
or migrate. Review existing targets when labeling a previously tracked site.
Keep IDs stable thereafter and never put personal information in labels or
mapped copy. API text scrubbing is a safeguard, not a substitute for exclusion.

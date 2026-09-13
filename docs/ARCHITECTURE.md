# Design notes

## The contract

The scanner supplies page evidence. A human reviews it before sharing with a model. The model proposes a scene specification. The builder checks a practical subset of its structure plus evidence consistency and encodes the shared shell with the spec into a bookmarklet. A standalone kit embeds both scan and spec so later edits use the same evidence.

The schema documents the broad format; explicit runtime checks are intentionally stricter about active HTML and require a scan. No claim is made that every JSON Schema keyword is executed.

## Public-edition changes

- English-first source templates, without the internal localization build or external knowledge-base lookup.
- Vendor branding, customer examples, internal distribution scripts and copied use-case content excluded.
- Original scan is mandatory for generation.
- Rich HTML limited to formatting tags; resource-bearing HTML and CSS URL content rejected by the builder.
- Reset restores references to original child nodes instead of recreating them from innerHTML; this preserves attached listeners in the covered regression case.
- Hand-authored fictional fixture and focused local browser tests.

## Deliberate limits

Bookmarklets depend on site/browser policy. The tool must not ask users to disable browser security controls; use the local example when execution is blocked. Browser-hosted application frameworks can rerender edited nodes. The restoration routine cannot provide a transaction across a site's state store, network effects and concurrent DOM updates.

The renderer retains 15 existing patterns. The public example demonstrates three, not all possible combinations. Custom content is restricted compared with the internal tool. This edition does not automatically deploy campaigns, host customer data, train a recommender or build a CRM.

Some bilingual fallback strings remain inside inherited runtime logic, but the distributed tools select English. The optional Gemini link does not bind the workflow to Gemini, and no live model evaluation was run for this public edition.

## Trust boundaries

A scanned selector can still point at a sensitive or unsuitable part of a page. A product copied faithfully from an untrusted page can still be wrong. Evidence validation reduces inconsistency; human review establishes whether the content is suitable. Exported files can contain every URL and field in their embedded scan. Review them before sharing.

## Verification record · 2026-09-13

Static source/JSON/public-file checks passed. The local in-app browser passed 19 checks covering mandatory scan evidence, rejected URLs/selectors/active content, example generation, scene rendering, node identity and listener preservation, relaunch, teardown and scanner output. The storefront and first scene were visually inspected. No third-party site, live model, actual Chrome bookmark installation, or full security audit was tested.

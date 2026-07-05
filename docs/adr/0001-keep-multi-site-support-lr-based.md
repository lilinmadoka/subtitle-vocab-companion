---
status: proposed
---

# Keep Multi-Site Support LR-Based

Subtitle Vocab Companion will add multi-site support by allowing the existing Language Reactor companion workflow to run on selected sites, starting with YouTube. It will not read YouTube or Bilibili native subtitle systems, because the product boundary is personal capture of visible LR/page context rather than generic subtitle scraping.

## Considered Options

- Add native subtitle adapters for each site.
- Keep capture LR-based and use site support only to decide where the extension can run.

## Consequences

YouTube support should be enabled with narrow host permissions and should stay quiet when LR subtitle/dictionary DOM is absent. Bilibili should remain experimental, use narrow URL patterns if enabled, and only capture when LR DOM is detected. Existing `vocabItems`, `settings_v1`, and export formats should remain compatible; new metadata such as `site`, `siteName`, and `pageTitle` must be additive.

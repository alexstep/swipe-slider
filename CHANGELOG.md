# Changelog

## 1.1.0 — 2026-10-07

Modernized the slider without renaming attributes, methods, or `swipe:*` events.

### Added

- Pointer Events as the primary input path. Touch and mouse remain only when `PointerEvent` is missing.
- Carousel keyboard and ARIA: arrow keys, slide labels, and a polite live region.
- RTL layout and `prefers-reduced-motion`.
- TypeScript declarations, `package.json` `exports`, and a custom elements manifest.
- Playwright tests, CI, and a GitHub Pages demo workflow.

### Fixed

- `passive-events` had no effect.
- `prev()` wrapped to the last slide when `loop` was off.
- `appendSlide()` and `prependSlide()` left `getNumSlides()` and loop clones stale.
- `disconnectedCallback()` could attach listeners after the element was removed.
- `swipe:*` events are `composed`, as already documented.
- The demo mousewheel toggle now sets `no-mousewheel`.

### Changed

- `direction` is unchanged: `-1` moves toward the next index, `1` toward the previous index.

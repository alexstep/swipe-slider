# Changelog

## 1.1.1 — 2026-10-21

### Fixed

- `slide()` no longer wraps around when `loop` is off; out-of-range and non-numeric indexes are clamped or ignored.
- Rapid `next()` / `prev()` calls in loop mode no longer drop steps.
- `kill()` cancels a pending transition frame.
- Loop clones no longer duplicate `id` attributes.
- Arrow keys are left to buttons, links, form fields, and descendants with their own ARIA role (for example `slider` or `tab`).
- A click after a swipe is suppressed, and mouse dragging no longer selects text.
- The mouse wheel respects `ignore`.
- `will-change` is set on the active slide and its neighbors only during a drag or transition, not permanently.
- The demo no longer binds `swipe:change` twice.

### Changed

- `@playwright/test` 1.64.1; GitHub Actions pinned to commit SHAs; CI builds `dist/` on every run.

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

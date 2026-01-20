# Pure Swipe Slider Web Component

[![Bundle Size](https://img.shields.io/badge/gzipped_size-%3C_4_KB-blue)](https://github.com/alexstep/swipe-slider)
[![Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)](https://github.com/alexstep/swipe-slider)
[![License](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)
[![NPM Version](https://img.shields.io/npm/v/pure-swipe-slider)](https://www.npmjs.com/package/pure-swipe-slider)

[**Live Demo**](https://alexstep.github.io/swipe-slider/demo.html)

A tiny, zero-dependency swipe slider as a Web Component (< 4 KB gzipped).
Framework-agnostic, mobile-first, event-driven.

Built on top of Swipe.js with modernized internals, Pointer Events, GPU-accelerated transforms, and a clean Custom Events interface.

## Two ways to use

- `<swipe-slider>` — Web Component for 99% of cases
- `swipe3.js` — low-level engine for advanced / legacy layouts

## Features

- **Full API access**: call `next()`, `prev()`, `slide()` directly on the element
- **Unified input handling**: touch, mouse, wheel, pen via Pointer Events
- **Mobile-optimized**: smooth 60fps animations with iOS overscroll handling
- **Framework-ready**: standard HTML tag with Custom Events
- **Flexible content**: images, dates, complex layouts, and dynamic slides
- **Performance-first**: GPU acceleration and modern optimizations
- **No build step**: works directly in modern browsers

## Installation

### From NPM

```bash
npm install pure-swipe-slider
```

### Quick Start

Simply import the component with default tag registration:

```javascript
import 'pure-swipe-slider/register.js';
```

### Custom Tag Registration

Import the class separately to register with your own tag name:

```javascript
import SwipeSlider from 'pure-swipe-slider';
import 'pure-swipe-slider/swipe-slider.css';

// Register with custom tag name
customElements.define('my-slider', SwipeSlider);
```

### Manual CSS Import

If you're using a bundler that doesn't handle CSS imports automatically, or if you're importing the class separately, make sure to include the CSS:

```javascript
import 'pure-swipe-slider/swipe-slider.css';
```

Then use it in HTML:

```html
<my-slider>
  <div>Slide 1</div>
  <div>Slide 2</div>
</my-slider>
```

## Class Usage

The `SwipeSlider` class can be extended for custom behavior:

```javascript
import SwipeSlider from './swipe-slider.js';

class MyCustomSlider extends SwipeSlider {
  connectedCallback() {
    super.connectedCallback();
    // Custom initialization
    this.style.border = '2px solid blue';
  }
}

// Register custom class
customElements.define('my-custom-slider', MyCustomSlider);
```

## Usage

### Basic Example

```html
<swipe-slider draggable mousewheel>
  <div>Slide 1</div>
  <div>Slide 2</div>
  <div>Slide 3</div>
</swipe-slider>
```

With default tag registration:

```javascript
import './register.js';
```

### With Event Listeners

```javascript
const slider = document.querySelector('swipe-slider');

slider.addEventListener('swipe:change', (e) => {
  const { index, element, direction } = e.detail;
  console.log(`Swiped to index ${index} in direction ${direction}`);
});
```

## API Reference

### Attributes

Boolean attributes follow HTML semantics: presence = `true`, absence = `false`.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `start-slide` | Number | `0` | Initial slide index. |
| `speed` | Number | `400` | Transition speed in milliseconds. |
| `draggable` | Boolean | `false` | Enable mouse dragging. |
| `mousewheel` | Boolean | `true` | Enable mouse wheel navigation. Use `no-mousewheel` to disable. |
| `disable-scroll` | Boolean | `false` | Disable vertical scrolling while swiping. |
| `stop-propagation` | Boolean | `false` | Stop event propagation. |
| `passive-events` | Boolean | `false` | Use passive event listeners (may improve performance but breaks preventDefault). |
| `loop` | Boolean | `false` | Enable infinite circular loop (moves slides dynamically). |
| `auto-height` | Boolean \| Number | `false` | Enable automatic height adjustment. Optional value sets min-height. |

### Events

All events are dispatched as CustomEvent with `{ bubbles: true, composed: true }`.

| Event | Detail | Description |
|-------|--------|-------------|
| `swipe:change` | `{ index, element, direction }` | Fired when the active slide changes. |
| `swipe:transition-end` | `{ index, element }` | Fired when the transition finishes. |
| `swipe:drag-start` | `{ index, element }` | Fired when dragging starts. |
| `swipe:drag-end` | `{ index, element }` | Fired when dragging ends. |
| `swipe:move` | `none` | Fired during movement (high-frequency event, use sparingly). |

### Methods

All `swipe.js` methods are proxied:

- `slide(to, speed)`
- `prev()`
- `next()`
- `getPos()`
- `getNumSlides()`
- `kill()`
- `setup(options)`
- `appendSlide(element)`
- `prependSlide(element)`
- `adjustHeight(element)`

## Direct Usage (swipe3.js)

For advanced use cases or when you don't need the web component wrapper, you can use `swipe3.js` directly:

### Import

```javascript
import Swipe from './swipe3.js';
```

### HTML Structure

```html
<div id="slider-container">
  <div class="slides">
    <div>Slide 1</div>
    <div>Slide 2</div>
    <div>Slide 3</div>
  </div>
</div>
```

### JavaScript Usage

```javascript
// Initialize
const container = document.getElementById('slider-container');
const swipeInstance = Swipe(container, {
  speed: 400,        // Transition speed in ms
  startSlide: 0,     // Initial slide index
  draggable: true,   // Enable mouse dragging
  mousewheel: true, // Enable mouse wheel navigation
  disableScroll: false, // Prevent vertical scrolling during swipe
  stopPropagation: false, // Stop event propagation
  passive: false,    // Use passive event listeners

  // Callbacks
  callback(index, element, direction) {
    console.log(`Swiped to slide ${index} in direction ${direction}`);
  },

  transitionEnd(index, element) {
    console.log(`Transition ended at slide ${index}`);
  },

  dragStart(index, element) {
    console.log(`Drag started at slide ${index}`);
  },

  dragEnd(index, element) {
    console.log(`Drag ended at slide ${index}`);
  },

  runMove() {
    console.log('Moving during drag');
  }
});

// Use API methods
swipeInstance.next();           // Go to next slide
swipeInstance.prev();           // Go to previous slide
swipeInstance.slide(2);         // Go to slide at index 2
swipeInstance.getPos();         // Get current slide index
swipeInstance.getNumSlides();   // Get total number of slides

// Add slides dynamically
const newSlide = document.createElement('div');
newSlide.textContent = 'New Slide';
swipeInstance.appendSlide(newSlide);

// Cleanup when done
swipeInstance.kill();
```

### Required CSS

When using directly, you'll need to add basic CSS:

```css
#slider-container {
  position: relative;
  overflow: hidden;
  width: 100%;
}

.slides {
  position: relative;
  white-space: nowrap;
}

.slides > * {
  display: inline-block;
  vertical-align: top;
  white-space: normal;
}
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `speed` | Number | `400` | Transition speed in milliseconds |
| `startSlide` | Number | `0` | Initial slide index |
| `draggable` | Boolean | `false` | Enable mouse dragging |
| `mousewheel` | Boolean | `true` | Enable mouse wheel navigation |
| `disableScroll` | Boolean | `false` | Disable vertical scrolling while swiping |
| `stopPropagation` | Boolean | `false` | Stop event propagation |
| `ignore` | String | `null` | CSS selector for elements to ignore (e.g., "button, a") |
| `passive` | Boolean | `false` | Use passive event listeners (may improve performance but breaks preventDefault) |

### Callback Functions

All callbacks receive `(index, element)` parameters where:
- `index`: Current slide index (0-based)
- `element`: Current slide DOM element

| Callback | Parameters | Description |
|----------|------------|-------------|
| `callback` | `(index, element, direction)` | Fired when slide changes (direction: -1 for prev, 1 for next) |
| `transitionEnd` | `(index, element)` | Fired when transition animation completes |
| `dragStart` | `(index, element)` | Fired when dragging starts |
| `dragEnd` | `(index, element)` | Fired when dragging ends |
| `runMove` | `none` | Fired during dragging movement |

### API Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `slide(to, speed?)` | `to`: slide index, `speed?`: optional transition speed | Navigate to specific slide |
| `prev()` | none | Go to previous slide |
| `next()` | none | Go to next slide |
| `getPos()` | none | Get current slide index |
| `getNumSlides()` | none | Get total number of slides |
| `appendSlide(element)` | `element`: DOM element | Add slide at the end |
| `prependSlide(element)` | `element`: DOM element | Add slide at the beginning |
| `setup(options?)` | `options?`: new options object | Reinitialize with new options |
| `kill()` | none | Destroy instance and cleanup events/styles |

## CSS Customization

The component provides a minimal CSS structure with a built-in height transition (0.2s linear) for `auto-height` mode. You can customize the look using standard CSS:

```css
swipe-slider {
  /* container styles */
}

.swipe-slider-wrapper > * {
  /* slide styles */
}
```

## When this is not a good fit

- If you need virtualized slides (1000+ items)
- If you rely heavily on React/Vue-specific lifecycles
- If you need autoplay / pagination / thumbnails out of the box
- If you need complex state management or data binding

## License

MIT

## Performance Optimizations (swipe3.js)

The internal `swipe3.js` engine includes these optimizations for smooth mobile performance:

| Optimization | Description |
|-------------|-------------|
| GPU-accelerated transforms | `translate3d` for hardware acceleration instead of `translateX` |
| will-change hints | Browser hints to create compositor layers for smoother animations |
| Pointer Events API | Unified touch/mouse/pen input handling with fallbacks |
| Passive event listeners | Non-blocking touch listeners where possible (via `passive-events` attr) |
| Reduced layout thrashing | Batched DOM reads/writes to minimize reflows |
| Modern ES6+ syntax | Latest JavaScript features for better performance and maintainability |
| Size (Gzipped) | < 4 KB for the entire component (JS + CSS) |

## Size

| Metric | JavaScript | CSS | Total |
|--------|------------|-----|-------|
| Minified | 9.8 KB | 0.3 KB | **10.1 KB** |
| Minified + Gzip | 3.2 KB | 0.2 KB | **3.4 KB** |

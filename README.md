# Swipe Slider Web Component

[**Live Demo**](https://alexstep.github.io/swipe-slider/demo.html)

**Zero-dependencies, framework agnostic vanilla JavaScript & CSS (< 4KB gzipped)**. A lightweight, universal web component wrapper for `swipe.js`, based on [Swipe](https://github.com/thebird/Swipe/) with modern optimizations for mobile performance. Designed for seamless integration into any web project with support for custom events and a declarative API. Just drop it into your project and start using it immediately.

## Features

- **Declarative**: Use as a standard HTML tag `<swipe-slider>`.
- **Event-driven**: All `swipe.js` callbacks are available as standard Custom Events.
- **Flexible**: Supports images, dates, complex layouts, and dynamic slide loading.
- **Mobile-friendly**: Optimized for touch interaction with support for iOS-specific tweaks.
- **Proxy Methods**: Access internal `swipe.js` methods directly on the element.
- **GPU-accelerated**: Uses `translate3d` and `will-change` for smooth 60fps animations.
- **Pointer Events**: Modern unified input handling (touch/mouse/pen).

## Installation

### Quick Start

Simply import the component with default tag registration:

```javascript
import './register.js';
```

### Custom Tag Registration

Import the class separately to register with your own tag name:

```javascript
import SwipeSlider from './swipe-slider.js';

// Register with custom tag name
customElements.define('my-slider', SwipeSlider);
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
| `auto-height` | Number | `none` | Enable automatic height adjustment. Optional value sets min-height. |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `swipe:change` | `{ index, element, direction }` | Fired when the active slide changes. |
| `swipe:transition-end` | `{ index, element }` | Fired when the transition finishes. |
| `swipe:drag-start` | `{ index, element }` | Fired when dragging starts. |
| `swipe:drag-end` | `{ index, element }` | Fired when dragging ends. |
| `swipe:move` | `none` | Fired during movement. |

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
| Size (Gzipped) | ~3.8 KB for the entire component (JS + CSS) |

## Size

| Metric | JavaScript | CSS | Total |
|--------|------------|-----|-------|
| Minified | 9.8 KB | 0.3 KB | **10.1 KB** |
| Minified + Gzip | 3.2 KB | 0.2 KB | **3.4 KB** |

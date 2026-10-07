import type { SwipeControls, SwipeOptions } from './swipe3.js'

export interface SwipeChangeDetail {
  index: number
  element: HTMLElement
  /** -1 toward the next index, 1 toward the previous index. */
  direction: number
}

export interface SwipeSlideDetail {
  index: number
  element: HTMLElement
}

export interface SwipeSliderEventMap {
  'swipe:change': CustomEvent<SwipeChangeDetail>
  'swipe:transition-end': CustomEvent<SwipeSlideDetail>
  'swipe:drag-start': CustomEvent<SwipeSlideDetail>
  'swipe:drag-end': CustomEvent<SwipeSlideDetail>
  'swipe:move': CustomEvent<Record<string, never>>
}

export interface SwipeSliderInitOptions extends Omit<SwipeOptions, 'startSlide'> {
  /** Logical slide index to show after init. */
  startSlide?: number
}

export default class SwipeSlider extends HTMLElement {
  /** Low-level engine instance, or null before the first frame and after kill(). */
  swipe: SwipeControls | null

  /**
   * Rebuild the track from current children.
   * `options.callback` and the other engine callbacks still receive the physical index.
   * `swipe:*` events receive the logical index.
   */
  init(options?: SwipeSliderInitOptions): void
  adjustHeight(el?: HTMLElement): void
  /** `to` is a logical index. */
  slide(to: number, speed?: number): void
  prev(): void
  next(): void
  /** Logical index of the active slide. */
  getPos(): number
  /** Number of real slides, excluding loop clones. */
  getNumSlides(): number
  kill(): void
  setup(options?: Partial<SwipeOptions>): void
  appendSlide(slide: Element): void
  prependSlide(slide: Element): void

  addEventListener<K extends keyof SwipeSliderEventMap>(
    type: K,
    listener: (this: SwipeSlider, ev: SwipeSliderEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener<K extends keyof SwipeSliderEventMap>(
    type: K,
    listener: (this: SwipeSlider, ev: SwipeSliderEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
}

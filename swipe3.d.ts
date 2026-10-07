export interface SwipeChangeDetail {
  index: number
  element: HTMLElement
  direction: number
}

export interface SwipeOptions {
  speed?: number
  startSlide?: number
  draggable?: boolean
  mousewheel?: boolean
  disableScroll?: boolean
  stopPropagation?: boolean
  ignore?: string | null
  passive?: boolean
  paused?: boolean
  /** -1 toward the next index, 1 toward the previous index. */
  callback?: (index: number, element: HTMLElement, direction: number) => void
  transitionEnd?: (index: number, element: HTMLElement) => void
  dragStart?: (index: number, element: HTMLElement) => void
  dragEnd?: (index: number, element: HTMLElement) => void
  runMove?: () => void
}

export interface SwipeControls {
  setup(options?: Partial<SwipeOptions>): void
  slide(to: number, speed?: number): void
  prev(): void
  next(): void
  getPos(): number
  getNumSlides(): number
  setIndex(index: number): void
  appendSlide(slide: Element): void
  prependSlide(slide: Element): void
  pause(): void
  resume(): void
  kill(): void
}

export default function Swipe(container: HTMLElement, options?: SwipeOptions): SwipeControls | null

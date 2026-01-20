import Swipe from './swipe3.js'

/**
 * Universal Swipe Slider Web Component
 * Wrapper around swipe.js
 *
 * @element swipe-slider
 * @attr {number} [start-slide=0] - Initial slide index
 * @attr {number} [speed=400] - Transition speed in milliseconds
 * @attr {boolean} [draggable=false] - Enable mouse dragging
 * @attr {boolean} [no-mousewheel] - Disable mouse wheel navigation
 * @attr {boolean} [disable-scroll=false] - Disable vertical scrolling while swiping
 * @attr {boolean} [stop-propagation=false] - Stop event propagation
 * @attr {boolean} [passive-events=false] - Use passive event listeners (may improve performance but breaks preventDefault)
 * @attr {boolean} [loop=false] - Enable infinite circular loop (moves slides dynamically)
 * @attr {number} [auto-height] - Enable automatic height adjustment. Optional value sets min-height.
 *
 * @fires swipe:change - Fired when the active slide changes. Detail: { index, element, direction }
 * @fires swipe:transition-end - Fired when the transition finishes. Detail: { index, element }
 * @fires swipe:drag-start - Fired when dragging starts. Detail: { index, element }
 * @fires swipe:drag-end - Fired when dragging ends. Detail: { index, element }
 * @fires swipe:move - Fired during movement.
 */
export default class SwipeSlider extends HTMLElement {
  constructor() {
    super()
    /** @type {Object|null} Internal Swipe instance */
    this.swipe = null
    /** @private @type {Object} Internal options storage */
    this._options = {}
  }

  /** @private */
  connectedCallback() {
    this.init()
  }

  /** @private */
  disconnectedCallback() {
    this.kill()
  }

  /**
   * Initialize or re-initialize the swipe instance
   * @param {Object} [options] - Manual options override
   */
  init(options = {}) {
    if (this.swipe) {
      this.kill()
    }

    // Default options from attributes
    const startSlide = parseInt(this.getAttribute('start-slide'), 10) || 0
    const speed = parseInt(this.getAttribute('speed'), 10) || 400
    const draggable = this.hasAttribute('draggable')
    const mousewheel = !this.hasAttribute('no-mousewheel')
    const disableScroll = this.hasAttribute('disable-scroll')
    const stopPropagation = this.hasAttribute('stop-propagation')
    const passive = this.hasAttribute('passive-events')
    const loop = this.hasAttribute('loop')
    const autoHeight = this.getAttribute('auto-height')

    this._options = {
      startSlide,
      speed,
      draggable,
      mousewheel,
      disableScroll,
      stopPropagation,
      passive,
      ...options,
      callback: (index, element, direction) => {
        if (autoHeight !== null) {
          this.adjustHeight(element)
        }

        // Handle circular loop if enabled
        if (loop && this.swipe) {
          const total = this.swipe.getNumSlides()
          const isLast = index === total - 1
          const isFirst = index === 0

          if (isLast || isFirst) {
            const method = isLast ? 'appendSlide' : 'prependSlide'
            const wrapper = this.querySelector('.swipe-slider-wrapper')
            const slideToMove = isLast ? wrapper?.firstElementChild : wrapper?.lastElementChild

            if (slideToMove) {
              this[method](slideToMove)
            }
          }
        }

        this.dispatchEvent(
          new CustomEvent('swipe:change', {
            detail: { index, element, direction },
            bubbles: true,
          })
        )
        if (options.callback) options.callback(index, element, direction)
      },
      transitionEnd: (index, element) => {
        this.dispatchEvent(
          new CustomEvent('swipe:transition-end', {
            detail: { index, element },
            bubbles: true,
          })
        )
        if (options.transitionEnd) options.transitionEnd(index, element)
      },
      dragStart: (index, element) => {
        this.dispatchEvent(
          new CustomEvent('swipe:drag-start', {
            detail: { index, element },
            bubbles: true,
          })
        )
        if (options.dragStart) options.dragStart(index, element)
      },
      dragEnd: (index, element) => {
        this.dispatchEvent(
          new CustomEvent('swipe:drag-end', {
            detail: { index, element },
            bubbles: true,
          })
        )
        if (options.dragEnd) options.dragEnd(index, element)
      },
      runMove: () => {
        this.dispatchEvent(
          new CustomEvent('swipe:move', {
            bubbles: true,
          })
        )
        if (options.runMove) options.runMove()
      },
    }

    // Ensure proper HTML structure for Swipe.js
    // Swipe expects: container > wrapper > slides
    // We use 'this' as container
    let wrapper = this.querySelector('.swipe-slider-wrapper')
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.className = 'swipe-slider-wrapper'
      while (this.firstChild) {
        wrapper.appendChild(this.firstChild)
      }
      this.appendChild(wrapper)
    }

    // Wait for next frame to ensure dimensions are calculated
    requestAnimationFrame(() => {
      this.swipe = new Swipe(this, this._options)
      if (autoHeight !== null) {
        const activeSlide = this.swipe.getPos()
        const slides = this.querySelectorAll('.swipe-slider-wrapper > *')
        if (slides[activeSlide]) {
          this.adjustHeight(slides[activeSlide])
        }
      }
      this.dataset.ready = 'true'
    })
  }

  /**
   * Adjust slider height to match element height
   * @param {HTMLElement} element
   */
  adjustHeight(element) {
    if (!element) return
    const minHeight = parseInt(this.getAttribute('auto-height'), 10) || 0
    this.style.height = Math.max(element.offsetHeight, minHeight) + 'px'
  }

  /**
   * Move to a specific slide
   * @param {number} to - Slide index
   * @param {number} [speed] - Transition speed override
   */
  slide(to, speed) {
    return this.swipe?.slide(to, speed)
  }

  /** Move to the previous slide */
  prev() {
    return this.swipe?.prev()
  }

  /** Move to the next slide */
  next() {
    return this.swipe?.next()
  }

  /**
   * Get the current slide index
   * @returns {number}
   */
  getPos() {
    return this.swipe?.getPos()
  }

  /**
   * Get the total number of slides
   * @returns {number}
   */
  getNumSlides() {
    return this.swipe?.getNumSlides()
  }

  /** Kill the swipe instance and clean up */
  kill() {
    if (this.swipe) {
      this.swipe.kill()
      this.swipe = null
    }
    delete this.dataset.ready
  }

  /**
   * Re-setup the swipe instance with new options
   * @param {Object} options
   */
  setup(options) {
    if (this.swipe) {
      this.swipe.setup(options)
    }
  }

  /**
   * Append a new slide to the end
   * @param {HTMLElement} slide
   */
  appendSlide(slide) {
    if (this.swipe) {
      this.swipe.appendSlide(slide)
    }
  }

  /**
   * Prepend a new slide to the beginning
   * @param {HTMLElement} slide
   */
  prependSlide(slide) {
    if (this.swipe) {
      this.swipe.prependSlide(slide)
    }
  }
}

/**
 * Swipe 3.0 - Optimized for mobile performance
 * Based on https://github.com/thebird/Swipe
 *
 * Optimizations:
 * - GPU-accelerated transforms (translate3d)
 * - will-change hints for compositor
 * - Pointer Events API (unified touch/mouse/pen)
 * - Passive event listeners where possible
 * - Reduced layout thrashing
 * - Modern ES6+ syntax
 */

const root = typeof self === 'object' && self.self === self ? self : typeof globalThis === 'object' ? globalThis : this

/**
 * Debounce function execution
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay = 150) {
  let timeoutId = null

  function debounced(...args) {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      timeoutId = null
      fn.apply(this, args)
    }, delay)
  }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

/**
 * Check if event is cancelable
 * @param {Event} event
 * @returns {boolean}
 */
function isCancelable(event) {
  return event && (typeof event.cancelable !== 'boolean' || event.cancelable)
}

// Feature detection (cached)
const supports = {
  passiveEvents: (() => {
    let passive = false
    try {
      const opts = Object.defineProperty({}, 'passive', {
        get: () => {
          passive = true
          return true
        },
      })
      root.addEventListener('test', null, opts)
      root.removeEventListener('test', null, opts)
    } catch {
      passive = false
    }
    return passive
  })(),
  pointerEvents: 'PointerEvent' in root,
  touch: 'ontouchstart' in root,
}

/**
 * @constructor
 * @param {HTMLElement} container
 * @param {Object} [options]
 */
function Swipe(container, options = {}) {
  if (!container) return null

  // Options with defaults
  const config = {
    speed: 400, // Slightly slower for better smoothness (was 300)
    startSlide: 0,
    draggable: false,
    mousewheel: true,
    disableScroll: false,
    stopPropagation: false,
    ignore: null,
    passive: false, // use passive event listeners (may break preventDefault)
    ...options,
  }

  // Should use passive listeners? (only if browser supports and option enabled)
  const usePassive = config.passive && supports.passiveEvents

  // State
  let start = {}
  let delta = {}
  let isScrolling
  let index = parseInt(config.startSlide, 10) || 0

  // DOM references
  const element = container.children[0]
  if (!element) return null

  let slides
  let slidePos
  let width
  let length

  // Direction (LTR/RTL)
  const slideDir = (() => {
    const dir = root.getComputedStyle?.(container, null)?.getPropertyValue('direction')
    return dir === 'rtl' ? 'right' : 'left'
  })()

  // Debounced setup for resize
  const debouncedSetup = debounce(setup, 150)

  // Wheel timeout for debouncing wheel events
  let wheelEndTimeout = null

  // Event handlers object (for handleEvent pattern)
  const events = {
    handleEvent(event) {
      switch (event.type) {
        // Pointer Events (modern unified API)
        case 'pointerdown':
          this.onPointerDown(event)
          break
        case 'pointermove':
          this.onPointerMove(event)
          break
        case 'pointerup':
        case 'pointercancel':
        case 'pointerleave':
          this.onPointerUp(event)
          break

        // Legacy touch events (fallback)
        case 'touchstart':
          this.onTouchStart(event)
          break
        case 'touchmove':
          this.onTouchMove(event)
          break
        case 'touchend':
          this.onTouchEnd(event)
          break

        // Mouse events (fallback for draggable)
        case 'mousedown':
          this.onMouseDown(event)
          break
        case 'mousemove':
          this.onMouseMove(event)
          break
        case 'mouseup':
        case 'mouseleave':
          this.onMouseUp(event)
          break

        // Other
        case 'transitionend':
          this.onTransitionEnd(event)
          break
        case 'resize':
          debouncedSetup()
          break
        case 'wheel':
          this.onWheel(event)
          break
      }

      if (config.stopPropagation) {
        event.stopPropagation()
      }
    },

    // ========== Pointer Events (preferred) ==========
    pointerCaptured: false,

    onPointerDown(event) {
      // Ignore non-primary pointer (multi-touch)
      if (!event.isPrimary) return

      // Ignore if target matches ignore selector
      if (config.ignore && event.target.matches(config.ignore)) return

      // Store start position (do NOT capture yet - allow clicks to work)
      start = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now(),
        pointerId: event.pointerId,
      }

      isScrolling = undefined
      delta = {}
      this.pointerCaptured = false

      // Attach move/up listeners
      element.addEventListener('pointermove', this, { passive: false })
      element.addEventListener('pointerup', this)
      element.addEventListener('pointercancel', this)

      runDragStart(getPos(), slides[index])
    },

    onPointerMove(event) {
      if (!event.isPrimary || event.pointerId !== start.pointerId) return

      delta = {
        x: event.clientX - start.x,
        y: event.clientY - start.y,
      }

      // Determine scroll direction (one-time check)
      if (isScrolling === undefined) {
        const sensitivity = 10
        isScrolling = Math.abs(delta.y) > Math.abs(delta.x) + sensitivity

        // Capture pointer ONLY when we know this is a horizontal swipe
        if (!isScrolling && !this.pointerCaptured) {
          element.setPointerCapture(event.pointerId)
          this.pointerCaptured = true
        }
      }

      if (!isScrolling) {
        if (isCancelable(event)) event.preventDefault()

        runMove()

        // Apply resistance at boundaries
        const resistedDelta = applyResistance(delta.x)

        // Translate slides
        translate(index - 1, resistedDelta + slidePos[index - 1], 0)
        translate(index, resistedDelta + slidePos[index], 0)
        translate(index + 1, resistedDelta + slidePos[index + 1], 0)
      } else if (config.disableScroll && isCancelable(event)) {
        event.preventDefault()
      }
    },

    onPointerUp(event) {
      if (!event.isPrimary) return

      // Release capture only if we captured
      if (this.pointerCaptured) {
        element.releasePointerCapture(event.pointerId)
        this.pointerCaptured = false
      }

      // Remove listeners
      element.removeEventListener('pointermove', this)
      element.removeEventListener('pointerup', this)
      element.removeEventListener('pointercancel', this)

      this.finishSwipe()
    },

    // ========== Legacy Touch Events (fallback) ==========
    onTouchStart(event) {
      const touch = event.touches[0]
      if (!touch) return

      if (config.ignore && touch.target.matches(config.ignore)) return

      start = {
        x: touch.pageX,
        y: touch.pageY,
        time: Date.now(),
      }

      isScrolling = undefined
      delta = {}

      element.addEventListener('touchmove', this, supports.passiveEvents ? { passive: false } : false)
      element.addEventListener('touchend', this)

      runDragStart(getPos(), slides[index])
    },

    onTouchMove(event) {
      if (event.touches.length > 1 || (event.scale && event.scale !== 1)) return

      const touch = event.touches[0]

      delta = {
        x: touch.pageX - start.x,
        y: touch.pageY - start.y,
      }

      if (isScrolling === undefined) {
        const sensitivity = 10
        isScrolling = Math.abs(delta.y) > Math.abs(delta.x) + sensitivity
      }

      if (!isScrolling) {
        if (isCancelable(event)) event.preventDefault()

        runMove()

        const resistedDelta = applyResistance(delta.x)

        translate(index - 1, resistedDelta + slidePos[index - 1], 0)
        translate(index, resistedDelta + slidePos[index], 0)
        translate(index + 1, resistedDelta + slidePos[index + 1], 0)
      } else if (config.disableScroll && isCancelable(event)) {
        event.preventDefault()
      }
    },

    onTouchEnd() {
      element.removeEventListener('touchmove', this, supports.passiveEvents ? { passive: false } : false)
      element.removeEventListener('touchend', this)

      this.finishSwipe()
    },

    // ========== Mouse Events (for draggable option) ==========
    onMouseDown(event) {
      if (config.ignore && event.target.matches(config.ignore)) return

      event.preventDefault() // Prevent text selection

      start = {
        x: event.pageX,
        y: event.pageY,
        time: Date.now(),
      }

      isScrolling = undefined
      delta = {}

      element.addEventListener('mousemove', this)
      element.addEventListener('mouseup', this)
      element.addEventListener('mouseleave', this)

      runDragStart(getPos(), slides[index])
    },

    onMouseMove(event) {
      delta = {
        x: event.pageX - start.x,
        y: event.pageY - start.y,
      }

      if (isScrolling === undefined) {
        const sensitivity = 10
        isScrolling = sensitivity + Math.abs(delta.x) < Math.abs(delta.y)
      }

      if (!isScrolling) {
        runMove()

        const resistedDelta = applyResistance(delta.x)

        translate(index - 1, resistedDelta + slidePos[index - 1], 0)
        translate(index, resistedDelta + slidePos[index], 0)
        translate(index + 1, resistedDelta + slidePos[index + 1], 0)
      }
    },

    onMouseUp() {
      element.removeEventListener('mousemove', this)
      element.removeEventListener('mouseup', this)
      element.removeEventListener('mouseleave', this)

      this.finishSwipe()
    },

    // ========== Wheel Events ==========
    onWheel(event) {
      if (Math.abs(event.deltaX) < 3) return

      if (isCancelable(event)) event.preventDefault()

      // Initialize timing
      if (!delta.x) start.time = Date.now()

      // Apply progressive slowdown
      let slower = 0.7
      const absDelta = Math.abs(delta.x || 0)
      if (absDelta > width * 0.5) slower = 0.3
      if (absDelta > width) slower = 0.1
      if (absDelta > width * 1.5) slower = 0.05
      if (absDelta > width * 2) slower = 0.01

      delta = {
        x: (delta.x || 0) - event.deltaX * slower,
        y: (delta.y || 0) - event.deltaY * 0.5,
      }

      const resistedDelta = applyResistance(delta.x)

      translate(index - 1, resistedDelta + slidePos[index - 1], 0)
      translate(index, resistedDelta + slidePos[index], 0)
      translate(index + 1, resistedDelta + slidePos[index + 1], 0)

      // Debounce wheel end
      if (wheelEndTimeout) clearTimeout(wheelEndTimeout)
      wheelEndTimeout = setTimeout(() => {
        this.finishSwipe()
        delta = {}
        wheelEndTimeout = null
      }, 50)
    },

    // ========== Transition End ==========
    onTransitionEnd(event) {
      const slideIndex = parseInt(event.target.getAttribute('data-index'), 10)
      if (slideIndex === index) {
        runTransitionEnd(getPos(), slides[index])
      }
    },

    // ========== Common finish logic ==========
    finishSwipe() {
      const duration = Date.now() - start.time
      const absX = Math.abs(delta.x || 0)

      // Valid swipe: fast + short distance, or slow + long distance
      const isValidSlide = (duration < 250 && absX > 20) || absX > width / 2

      // Past bounds check
      const isPastBounds = (!index && delta.x > 0) || (index === slides.length - 1 && delta.x < 0)

      const direction = delta.x ? Math.abs(delta.x) / delta.x : 0

      if (!isScrolling && delta.x) {
        if (isValidSlide && !isPastBounds) {
          if (direction < 0) {
            // Swipe left (next)
            move(index - 1, -width, 0)
            move(index, slidePos[index] - width, config.speed)
            move(circle(index + 1), slidePos[circle(index + 1)] - width, config.speed)
            index = circle(index + 1)
          } else {
            // Swipe right (prev)
            move(index + 1, width, 0)
            move(index, slidePos[index] + width, config.speed)
            move(circle(index - 1), slidePos[circle(index - 1)] + width, config.speed)
            index = circle(index - 1)
          }
          runCallback(getPos(), slides[index], direction)
        } else {
          // Snap back
          move(index - 1, -width, config.speed)
          move(index, 0, config.speed)
          move(index + 1, width, config.speed)
        }
      }

      runDragEnd(getPos(), slides[index])
    },
  }

  // ========== Internal functions ==========

  function applyResistance(deltaX) {
    const atStart = !index && deltaX > 0
    const atEnd = index === slides.length - 1 && deltaX < 0
    if (atStart || atEnd) {
      return deltaX / (Math.abs(deltaX) / width + 1)
    }
    return deltaX
  }

  function circle(idx) {
    return (slides.length + (idx % slides.length)) % slides.length
  }

  function move(idx, dist, speed) {
    translate(idx, dist, speed)
    slidePos[idx] = dist
  }

  function translate(idx, dist, speed) {
    const slide = slides[idx]
    if (!slide?.style) return

    slide.style.transitionDuration = speed + 'ms'
    slide.style.transitionTimingFunction = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' // Smoother ease-out
    // GPU-accelerated transform
    slide.style.transform = `translate3d(${dist}px, 0, 0)`
  }

  function setup(opts) {
    if (opts) Object.assign(config, opts)

    slides = element.children
    length = slides.length

    if (!length) return

    // Read phase (avoid layout thrashing)
    width = container.getBoundingClientRect().width || container.offsetWidth

    // Write phase
    slidePos = new Array(length)
    element.style.width = length * width * 2 + 'px'

    // Setup each slide
    for (let i = length - 1; i >= 0; i--) {
      const slide = slides[i]

      // GPU optimization hints
      slide.style.willChange = 'transform'
      slide.style.width = width + 'px'
      slide.setAttribute('data-index', i)
      slide.style[slideDir] = i * -width + 'px'

      // RTL support
      if (slideDir === 'right') {
        slide.style.float = 'right'
      }

      // Initial position
      const initialDist = index > i ? -width : index < i ? width : 0
      move(i, initialDist, 0)
    }

    detachEvents()
    attachEvents()
  }

  function attachEvents() {
    // Passive option for start events (passive: true may break preventDefault)
    const passiveOption = usePassive ? { passive: true } : false

    // Use Pointer Events if available (preferred)
    if (supports.pointerEvents) {
      element.addEventListener('pointerdown', events, passiveOption)
    } else if (supports.touch) {
      // Fallback to touch events
      element.addEventListener('touchstart', events, passiveOption)
    }

    // Mouse dragging (desktop)
    if (config.draggable && !supports.pointerEvents) {
      element.addEventListener('mousedown', events)
    }

    // Wheel navigation (always non-passive to allow preventDefault)
    if (config.mousewheel) {
      element.addEventListener('wheel', events, { passive: false })
    }

    // Transition end
    element.addEventListener('transitionend', events)

    // Resize
    root.addEventListener('resize', events)
  }

  function detachEvents() {
    if (supports.pointerEvents) {
      element.removeEventListener('pointerdown', events)
      element.removeEventListener('pointermove', events)
      element.removeEventListener('pointerup', events)
      element.removeEventListener('pointercancel', events)
    } else {
      element.removeEventListener('touchstart', events)
      element.removeEventListener('touchmove', events)
      element.removeEventListener('touchend', events)
    }

    element.removeEventListener('mousedown', events)
    element.removeEventListener('mousemove', events)
    element.removeEventListener('mouseup', events)
    element.removeEventListener('mouseleave', events)

    element.removeEventListener('wheel', events)
    element.removeEventListener('transitionend', events)
    root.removeEventListener('resize', events)
  }

  function getPos() {
    let currentIndex = index
    if (currentIndex >= length) {
      currentIndex -= length
    }
    return currentIndex
  }

  function slideTo(to, slideSpeed) {
    to = typeof to === 'number' ? to : parseInt(to, 10)

    if (index === to) return

    const direction = Math.abs(index - to) / (index - to)
    let diff = Math.abs(index - to) - 1

    while (diff--) {
      move(circle((to > index ? to : index) - diff - 1), width * direction, 0)
    }

    to = circle(to)

    move(index, width * direction, slideSpeed ?? config.speed)
    move(to, 0, slideSpeed ?? config.speed)

    index = to

    requestAnimationFrame(() => {
      runCallback(getPos(), slides[index], direction)
    })
  }

  function prev() {
    slideTo(index - 1)
  }

  function next() {
    if (index < slides.length - 1) {
      slideTo(index + 1)
    }
  }

  function kill() {
    element.style.width = ''
    element.style[slideDir] = ''

    for (let i = slides.length - 1; i >= 0; i--) {
      const slide = slides[i]

      if (slide.getAttribute('data-cloned')) {
        slide.parentElement?.removeChild(slide)
        continue
      }

      // Reset styles
      slide.style.width = ''
      slide.style[slideDir] = ''
      slide.style.transitionDuration = ''
      slide.style.transform = ''
      slide.style.willChange = '' // Remove compositor hint
    }

    detachEvents()
    debouncedSetup.cancel()

    if (wheelEndTimeout) {
      clearTimeout(wheelEndTimeout)
      wheelEndTimeout = null
    }
  }

  // Callback runners
  function runCallback(pos, slide, dir) {
    config.callback?.(pos, slide, dir)
  }

  function runTransitionEnd(pos, slide) {
    config.transitionEnd?.(pos, slide)
  }

  function runDragStart(pos, slide) {
    config.dragStart?.(pos, slide)
  }

  function runDragEnd(pos, slide) {
    config.dragEnd?.(pos, slide)
  }

  function runMove() {
    config.runMove?.()
  }

  // Initialize
  setup()

  // Public API
  return {
    setup,
    slide: slideTo,
    prev,
    next,
    getPos,
    getNumSlides: () => length,
    setIndex: newIndex => {
      index = newIndex
    },
    appendSlide: slide => {
      element.children[0]?.remove()
      element.appendChild(slide)
      index--
      setup()
    },
    prependSlide: slide => {
      element.children[element.children.length - 1]?.remove()
      element.prepend(slide)
      index++
      setup()
    },
    kill,
  }
}

export default Swipe

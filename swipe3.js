/**
 * Swipe 3 — pointer-driven slide engine.
 * Based on https://github.com/thebird/Swipe (Brad Birdsall, MIT).
 *
 * Direction passed to callbacks follows the original engine:
 * -1 moves toward the next index, 1 moves toward the previous index.
 */

const root = typeof globalThis === 'object' ? globalThis : self

function debounce(fn, d = 150) {
  let t
  const f = (...a) => (clearTimeout(t), t = setTimeout(() => fn.apply(this, a), d))
  f.cancel = () => clearTimeout(t)
  return f
}

const EASING = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'

const supportsPointer = typeof root.PointerEvent === 'function'

function prefersReducedMotion() {
  return !!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
}

function Swipe(container, options = {}) {
  if (!container) return null

  const config = {
    speed: 400,
    startSlide: 0,
    draggable: false,
    mousewheel: true,
    disableScroll: false,
    stopPropagation: false,
    ignore: null,
    passive: false,
    paused: false,
    ...options,
  }

  let start = {}
  let delta = {}
  let isScrolling
  let index = parseInt(config.startSlide, 10)
  if (!Number.isFinite(index)) index = 0

  const element = container.children[0]
  if (!element) return null

  let slides, slidePos, width, length, easing, slideDir
  const debouncedSetup = debounce(() => setup(), 150)
  let wheelEndTimeout = null
  let resizeObserver = null
  let tracking = false
  let alive = true
  let slideFrame = 0
  let clickGuard = null
  let clickGuardTimer = null

  const run = (name, a, b, c) => config[name]?.(a, b, c)

  const moveListenerOptions = () => ({ passive: !!config.passive })

  function axisDelta(x) {
    // Positive delta still means "toward the previous index".
    // In RTL the track is mirrored, so invert the pointer delta.
    return slideDir === 'right' ? start.x - x : x - start.x
  }

  function ignored(event) {
    if (!config.ignore) return false
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement
    return !!target?.closest?.(config.ignore)
  }

  function mouseBlocked(event) {
    return event.pointerType === 'mouse' && !config.draggable
  }

  const events = {
    handleEvent(event) {
      switch (event.type) {
        case 'pointerdown':
          if (!event.isPrimary || mouseBlocked(event)) return
          if (event.pointerType === 'mouse' && event.button !== 0) return
          this.onStart(event, event.clientX, event.clientY, event.pointerId)
          break
        case 'pointermove':
          if (!tracking || !event.isPrimary || event.pointerId !== start.pointerId) return
          this.onMove(event, event.clientX, event.clientY)
          break
        case 'pointerup':
          if (!tracking || !event.isPrimary || event.pointerId !== start.pointerId) return
          this.onEnd(event)
          break
        case 'pointercancel':
          if (!tracking || event.pointerId !== start.pointerId) return
          this.onEnd(event, true)
          break
        case 'lostpointercapture':
          if (!tracking || event.pointerId !== start.pointerId) return
          this.onEnd(event, true)
          break

        case 'touchstart':
          if (event.touches[0]) this.onStart(event, event.touches[0].pageX, event.touches[0].pageY)
          break
        case 'touchmove':
          if (event.touches.length === 1 && !(event.scale && event.scale !== 1)) {
            this.onMove(event, event.touches[0].pageX, event.touches[0].pageY)
          }
          break
        case 'touchend':
        case 'touchcancel':
          this.onEnd(event, event.type === 'touchcancel')
          break

        case 'mousedown':
          if (!config.draggable) return
          if (!config.passive && event.cancelable) event.preventDefault()
          this.onStart(event, event.pageX, event.pageY)
          break
        case 'mousemove':
          this.onMove(event, event.pageX, event.pageY)
          break
        case 'mouseup':
          this.onEnd(event)
          break

        case 'transitionend':
          if (event.propertyName && event.propertyName !== 'transform') return
          if (event.target?.parentNode !== element) return
          if (parseInt(event.target.getAttribute('data-index'), 10) === index) {
            markMotion(false)
            run('transitionEnd', index, slides[index])
          }
          break
        case 'resize':
          debouncedSetup()
          break
        case 'wheel':
          this.onWheel(event)
          break
      }

      if (config.stopPropagation) event.stopPropagation()
    },

    onStart(event, x, y, pointerId) {
      if (config.paused || tracking || ignored(event)) return

      disarmClick()
      start = { x, y, time: Date.now(), pointerId }
      isScrolling = undefined
      delta = {}
      tracking = true
      armSelectBlock()
      markMotion(true)

      if (event.type === 'pointerdown') {
        element.addEventListener('pointermove', this, moveListenerOptions())
        element.addEventListener('pointerup', this, { passive: true })
        element.addEventListener('pointercancel', this, { passive: true })
        element.addEventListener('lostpointercapture', this, { passive: true })
        try {
          element.setPointerCapture(event.pointerId)
        } catch {
          /* synthetic or already released */
        }
      } else if (event.type === 'touchstart') {
        element.addEventListener('touchmove', this, moveListenerOptions())
        element.addEventListener('touchend', this, { passive: true })
        element.addEventListener('touchcancel', this, { passive: true })
      } else {
        element.addEventListener('mousemove', this)
        root.addEventListener('mouseup', this)
      }

      run('dragStart', index, slides[index])
    },

    onMove(event, x, y) {
      if (!width) return
      delta = { x: axisDelta(x), y: y - start.y }

      if (isScrolling === undefined) {
        isScrolling = Math.abs(delta.y) > Math.abs(delta.x) + 10
      }

      if (isScrolling) {
        if (config.disableScroll) prevent(event)
        return
      }

      prevent(event)
      run('runMove')
      translateNeighbors(applyResistance(delta.x))
    },

    onEnd(event, cancel) {
      if (!tracking) return
      const horizontalDrag = !isScrolling && Math.abs(delta.x || 0) > 10
      tracking = false
      stopTracking(event)

      if (!cancel && !isScrolling && delta.x) finishSwipe()
      else if (delta.x) snapBack()

      run('dragEnd', index, slides[index])
      if ((cancel || delta.x) && motionMs(config.speed) === 0 && !isScrolling) {
        settle()
      }
      if (!cancel && horizontalDrag) armClickSuppression()
      delta = {}
    },

    onWheel(event) {
      if (config.paused || !width || ignored(event)) return
      let deltaX = event.deltaX
      let deltaY = event.deltaY
      if (event.deltaMode === 1) {
        deltaX *= 40
        deltaY *= 40
      } else if (event.deltaMode === 2) {
        deltaX *= width
        deltaY *= width
      }
      if (slideDir === 'right') deltaX = -deltaX

      if (Math.abs(deltaX) < 3) return
      prevent(event)

      if (!delta.x) start.time = Date.now()

      const absDelta = Math.abs(delta.x || 0)
      const slower =
        absDelta > width * 2 ? 0.01 :
        absDelta > width * 1.5 ? 0.05 :
        absDelta > width ? 0.1 :
        absDelta > width * 0.5 ? 0.3 : 0.7

      delta = {
        x: (delta.x || 0) - deltaX * slower,
        y: (delta.y || 0) - deltaY * 0.5,
      }

      translateNeighbors(applyResistance(delta.x))

      if (wheelEndTimeout) clearTimeout(wheelEndTimeout)
      wheelEndTimeout = setTimeout(() => {
        finishSwipe()
        run('dragEnd', index, slides[index])
        if (motionMs(config.speed) === 0) settle()
        delta = {}
        wheelEndTimeout = null
      }, 50)
    },
  }

  function prevent(event) {
    if (config.passive) return
    if (event.cancelable) event.preventDefault()
  }

  function disarmClick() {
    if (clickGuardTimer) {
      clearTimeout(clickGuardTimer)
      clickGuardTimer = null
    }
    if (!clickGuard) return
    element.removeEventListener('click', clickGuard, true)
    clickGuard = null
  }

  function armClickSuppression() {
    disarmClick()
    clickGuard = (event) => {
      event.preventDefault()
      event.stopPropagation()
      disarmClick()
    }
    element.addEventListener('click', clickGuard, true)
    // Click follows pointerup in the same turn. Drop the guard if the browser never emits one.
    clickGuardTimer = setTimeout(disarmClick, 400)
  }

  function blockSelect(event) {
    event.preventDefault()
  }

  function armSelectBlock() {
    element.addEventListener('selectstart', blockSelect)
    element.addEventListener('dragstart', blockSelect)
    element.style.userSelect = 'none'
  }

  function disarmSelectBlock() {
    element.removeEventListener('selectstart', blockSelect)
    element.removeEventListener('dragstart', blockSelect)
    element.style.userSelect = ''
  }

  function stopTracking(event) {
    disarmSelectBlock()
    if (supportsPointer) {
      element.removeEventListener('pointermove', events)
      element.removeEventListener('pointerup', events)
      element.removeEventListener('pointercancel', events)
      element.removeEventListener('lostpointercapture', events)
      if (event?.pointerId != null && element.hasPointerCapture?.(event.pointerId)) {
        try {
          element.releasePointerCapture(event.pointerId)
        } catch {
          /* already released */
        }
      }
      return
    }
    element.removeEventListener('touchmove', events)
    element.removeEventListener('touchend', events)
    element.removeEventListener('touchcancel', events)
    element.removeEventListener('mousemove', events)
    root.removeEventListener('mouseup', events)
  }

  function finishSwipe() {
    const duration = Date.now() - start.time
    const absX = Math.abs(delta.x || 0)
    const isValidSlide = (duration < 250 && absX > 20) || absX > width / 2
    const isPastBounds = (!index && delta.x > 0) || (index === slides.length - 1 && delta.x < 0)
    const direction = delta.x ? Math.abs(delta.x) / delta.x : 0

    if (isValidSlide && !isPastBounds) {
      if (direction < 0) {
        move(index - 1, -width, 0)
        move(index, slidePos[index] - width, config.speed)
        move(circle(index + 1), slidePos[circle(index + 1)] - width, config.speed)
        index = circle(index + 1)
      } else {
        move(index + 1, width, 0)
        move(index, slidePos[index] + width, config.speed)
        move(circle(index - 1), slidePos[circle(index - 1)] + width, config.speed)
        index = circle(index - 1)
      }
      run('callback', index, slides[index], direction)
    } else {
      snapBack()
    }
  }

  function snapBack() {
    move(index - 1, -width, config.speed)
    move(index, 0, config.speed)
    move(index + 1, width, config.speed)
  }

  function markMotion(on) {
    if (!slides) return
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      if (slide?.style) slide.style.willChange = on && Math.abs(i - index) <= 1 ? 'transform' : ''
    }
  }

  function settle() {
    markMotion(false)
    run('transitionEnd', index, slides[index])
  }

  function applyResistance(deltaX) {
    const atStart = !index && deltaX > 0
    const atEnd = index === slides.length - 1 && deltaX < 0
    return atStart || atEnd ? deltaX / (Math.abs(deltaX) / width + 1) : deltaX
  }

  function circle(idx) {
    return (idx % length + length) % length
  }

  function move(idx, dist, speed) {
    translate(idx, dist, speed)
    if (slidePos && idx >= 0 && idx < length) slidePos[idx] = dist
  }

  function motionMs(speed) {
    return prefersReducedMotion() ? 0 : speed
  }

  function translate(idx, dist, speed) {
    const slide = slides?.[idx]
    if (!slide?.style) return
    const ms = motionMs(speed)
    // dist is logical: positive is the next index. RTL mirrors that onto the left.
    const visual = slideDir === 'right' ? -dist : dist
    slide.style.transitionProperty = 'transform'
    slide.style.transitionDuration = ms + 'ms'
    slide.style.transitionTimingFunction = easing || EASING
    slide.style.transform = `translate3d(${visual}px, 0, 0)`
  }

  function translateNeighbors(dx) {
    translate(index - 1, dx + (slidePos[index - 1] || 0), 0)
    translate(index, dx + (slidePos[index] || 0), 0)
    translate(index + 1, dx + (slidePos[index + 1] || 0), 0)
  }

  function readDirection() {
    const dir = root.getComputedStyle?.(container)?.direction
    slideDir = dir === 'rtl' ? 'right' : 'left'
  }

  function setup(opts) {
    if (opts) Object.assign(config, opts)

    slides = element.children
    length = slides.length
    if (!length) return

    if (index > length - 1) index = length - 1
    if (index < 0) index = 0

    readDirection()
    easing = root.getComputedStyle?.(container)?.getPropertyValue('--swipe-easing')?.trim() || EASING
    width = container.clientWidth || container.offsetWidth || 0

    slidePos = new Array(length)
    const track = length * width * 2
    element.style.width = track + 'px'
    // A wide track inside an RTL host aligns to the right. Shift it back so slide 0 stays in view.
    element.style.transform = slideDir === 'right' ? `translateX(${Math.max(0, track - width)}px)` : ''

    for (let i = length - 1; i >= 0; i--) {
      const slide = slides[i]
      slide.style.width = width + 'px'
      slide.setAttribute('data-index', String(i))
      slide.style.right = ''
      slide.style.float = 'left'
      slide.style.left = i * -width + 'px'

      const initialDist = index > i ? -width : index < i ? width : 0
      move(i, initialDist, 0)
    }

    detachEvents()
    attachEvents()
  }

  function attachEvents() {
    if (supportsPointer) {
      element.addEventListener('pointerdown', events, { passive: true })
    } else {
      element.addEventListener('touchstart', events, { passive: true })
      if (config.draggable) element.addEventListener('mousedown', events)
    }
    element.addEventListener('transitionend', events)
    if (config.mousewheel) element.addEventListener('wheel', events, moveListenerOptions())
    if (typeof root.ResizeObserver === 'function') {
      if (!resizeObserver) {
        resizeObserver = new root.ResizeObserver(() => {
          const next = container.clientWidth || container.offsetWidth || 0
          if (next !== width) debouncedSetup()
        })
        resizeObserver.observe(container)
      }
    } else {
      root.addEventListener('resize', events, { passive: true })
    }
  }

  function detachEvents() {
    disarmSelectBlock()
    const names = supportsPointer
      ? ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
      : ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mousemove', 'mouseup']
    names.forEach(name => {
      element.removeEventListener(name, events)
      root.removeEventListener(name, events)
    })
    element.removeEventListener('wheel', events)
    element.removeEventListener('transitionend', events)
    root.removeEventListener('resize', events)
  }

  function slideTo(to, slideSpeed) {
    if (!alive) return
    to = typeof to === 'number' ? to : parseInt(to, 10)
    if (!Number.isFinite(to) || !length || !width) return
    to = Math.min(length - 1, Math.max(0, Math.trunc(to)))
    if (index === to) return

    const direction = Math.abs(index - to) / (index - to)
    let diff = Math.abs(index - to) - 1
    while (diff--) move((to > index ? to : index) - diff - 1, width * direction, 0)

    const ms = slideSpeed ?? config.speed
    move(index, width * direction, ms)
    move(to, 0, ms)
    index = to
    markMotion(true)

    cancelAnimationFrame(slideFrame)
    slideFrame = requestAnimationFrame(() => {
      slideFrame = 0
      if (!alive) return
      run('callback', index, slides[index], direction)
      if (motionMs(ms) === 0) settle()
    })
  }

  function prev() {
    if (index > 0) slideTo(index - 1)
  }

  function next() {
    if (index < slides.length - 1) slideTo(index + 1)
  }

  function kill() {
    alive = false
    cancelAnimationFrame(slideFrame)
    slideFrame = 0
    markMotion(false)
    disarmClick()
    stopTracking()
    detachEvents()
    debouncedSetup.cancel()
    resizeObserver?.disconnect()
    resizeObserver = null

    if (wheelEndTimeout) {
      clearTimeout(wheelEndTimeout)
      wheelEndTimeout = null
    }

    element.style.width = ''
    element.style.transform = ''
    for (let i = slides.length - 1; i >= 0; i--) {
      const slide = slides[i]
      if (slide.getAttribute('data-cloned')) {
        slide.remove()
        continue
      }
      slide.style.width = ''
      slide.style.left = ''
      slide.style.right = ''
      slide.style.float = ''
      slide.style.transitionProperty = ''
      slide.style.transitionDuration = ''
      slide.style.transitionTimingFunction = ''
      slide.style.transform = ''
      slide.style.willChange = ''
      slide.removeAttribute('data-index')
    }
  }

  setup()

  return {
    setup,
    slide: slideTo,
    prev,
    next,
    getPos: () => index,
    getNumSlides: () => length,
    setIndex: i => {
      index = i
    },
    appendSlide: s => {
      element.appendChild(s)
      setup()
    },
    prependSlide: s => {
      element.prepend(s)
      index++
      setup()
    },
    pause: () => {
      config.paused = true
    },
    resume: () => {
      config.paused = false
    },
    kill,
  }
}

export default Swipe

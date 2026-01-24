/**
 * Swipe 3.0 - Optimized for mobile performance
 * Based on https://github.com/thebird/Swipe
 */

const root = typeof self === 'object' && self.self === self ? self : typeof globalThis === 'object' ? globalThis : this

function debounce(fn, d = 150) {
  let t
  const f = (...a) => (clearTimeout(t), t = setTimeout(() => fn.apply(this, a), d))
  f.cancel = () => clearTimeout(t)
  return f
}

const isCancelable = e => e?.cancelable !== false

const supports = {
  pointerEvents: 'PointerEvent' in root,
  touch: 'ontouchstart' in root,
}

const EVENT_TYPES = {
  pointer: { move: 'pointermove', end: ['pointerup', 'pointercancel', 'pointerleave'] },
  touch: { move: 'touchmove', end: ['touchend'] },
  mouse: { move: 'mousemove', end: ['mouseup', 'mouseleave'] },
}

const EASING = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'

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
    paused: false,
    ...options,
  }

  let start = {}
  let delta = {}
  let isScrolling
  let index = parseInt(config.startSlide, 10) || 0

  const element = container.children[0]
  if (!element) return null

  let slides, slidePos, width, length

  const slideDir = (() => {
    const dir = root.getComputedStyle?.(container, null)?.getPropertyValue('direction')
    return dir === 'rtl' ? 'right' : 'left'
  })()

  const debouncedSetup = debounce(setup, 150)
  let wheelEndTimeout = null

  const run = (n, a, b, c) => config[n]?.(a, b, c)

  // Unified event handlers
  const events = {
    handleEvent(event) {
      switch (event.type) {
        case 'pointerdown':
          this.onStart(event, event.clientX, event.clientY, event.pointerId)
          break
        case 'pointermove':
          if (event.isPrimary && event.pointerId === start.pointerId) {
            this.onMove(event, event.clientX, event.clientY)
          }
          break
        case 'pointerup':
        case 'pointercancel':
        case 'pointerleave':
          this.onEnd(event, 'pointer')
          break

        case 'touchstart':
          if (event.touches[0]) {
            this.onStart(event, event.touches[0].pageX, event.touches[0].pageY)
          }
          break
        case 'touchmove':
          if (event.touches.length === 1 && !(event.scale && event.scale !== 1)) {
            this.onMove(event, event.touches[0].pageX, event.touches[0].pageY)
          }
          break
        case 'touchend':
          this.onEnd(event, 'touch')
          break

        case 'mousedown':
          event.preventDefault()
          this.onStart(event, event.pageX, event.pageY)
          break
        case 'mousemove':
          this.onMove(event, event.pageX, event.pageY)
          break
        case 'mouseup':
        case 'mouseleave':
          this.onEnd(event, 'mouse')
          break

        case 'transitionend':
          if (parseInt(event.target.getAttribute('data-index'), 10) === index) {
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

    captured: false,

    onStart(event, x, y, pointerId) {
      if (config.paused) return
      if (event.type === 'pointerdown' && !event.isPrimary) return
      if (config.ignore && event.target.matches(config.ignore)) return

      start = { x, y, time: Date.now(), pointerId }
      isScrolling = undefined
      delta = {}
      this.captured = false

      const type = event.type === 'pointerdown' ? 'pointer' : event.type === 'touchstart' ? 'touch' : 'mouse'
      const evts = EVENT_TYPES[type]
      element.addEventListener(evts.move, this, { passive: false })
      evts.end.forEach(e => element.addEventListener(e, this))

      run('dragStart', index, slides[index])
    },

    onMove(event, x, y) {
      delta = { x: x - start.x, y: y - start.y }

      if (isScrolling === undefined) {
        const sensitivity = 10
        isScrolling = Math.abs(delta.y) > Math.abs(delta.x) + sensitivity

        if (!isScrolling && !this.captured && event.type === 'pointermove') {
          element.setPointerCapture(event.pointerId)
          this.captured = true
        }
      }

      if (!isScrolling) {
        if (isCancelable(event)) event.preventDefault()
        run('runMove')

        const resistedDelta = applyResistance(delta.x)
        translateNeighbors(resistedDelta)
      } else if (config.disableScroll && isCancelable(event)) {
        event.preventDefault()
      }
    },

    onEnd(event, type) {
      if (type === 'pointer' && !event.isPrimary) return

      if (this.captured) {
        element.releasePointerCapture(event.pointerId)
        this.captured = false
      }

      const evts = EVENT_TYPES[type]
      element.removeEventListener(evts.move, this)
      evts.end.forEach(e => element.removeEventListener(e, this))

      this.finishSwipe()
    },

    onWheel(event) {
      if (config.paused) return
      let deltaX = event.deltaX
      let deltaY = event.deltaY
      if (event.deltaMode === 1) {
        deltaX *= 40
        deltaY *= 40
      } else if (event.deltaMode === 2) {
        deltaX *= width
        deltaY *= width
      }

      if (Math.abs(deltaX) < 3) return
      if (isCancelable(event)) event.preventDefault()

      if (!delta.x) start.time = Date.now()

      const absDelta = Math.abs(delta.x || 0)
      const slower =
        absDelta > width * 2   ? 0.01 :
        absDelta > width * 1.5 ? 0.05 :
        absDelta > width       ? 0.1  :
        absDelta > width * 0.5 ? 0.3  : 0.7

      delta = {
        x: (delta.x || 0) - deltaX * slower,
        y: (delta.y || 0) - deltaY * 0.5,
      }

      const resistedDelta = applyResistance(delta.x)
      translateNeighbors(resistedDelta)

      if (wheelEndTimeout) clearTimeout(wheelEndTimeout)
      wheelEndTimeout = setTimeout(() => {
        this.finishSwipe()
        delta = {}
        wheelEndTimeout = null
      }, 50)
    },

    finishSwipe() {
      const duration = Date.now() - start.time
      const absX = Math.abs(delta.x || 0)
      const isValidSlide = (duration < 250 && absX > 20) || absX > width / 2
      const isPastBounds = (!index && delta.x > 0) || (index === slides.length - 1 && delta.x < 0)
      const direction = delta.x ? Math.abs(delta.x) / delta.x : 0

      if (!isScrolling && delta.x) {
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
          move(index - 1, -width, config.speed)
          move(index, 0, config.speed)
          move(index + 1, width, config.speed)
        }
      }

      run('dragEnd', index, slides[index])
    },
  }

  function applyResistance(deltaX) {
    const atStart = !index && deltaX > 0
    const atEnd = index === slides.length - 1 && deltaX < 0
    return atStart || atEnd
      ? deltaX / (Math.abs(deltaX) / width + 1)
      : deltaX
  }

  function circle(idx) {
    return (idx + length) % length
  }

  function move(idx, dist, speed) {
    translate(idx, dist, speed)
    slidePos[idx] = dist
  }

  function translate(idx, dist, speed) {
    const slide = slides[idx]
    if (!slide?.style) return

    slide.style.transitionDuration = speed + 'ms'
    slide.style.transitionTimingFunction = EASING
    slide.style.transform = `translate3d(${dist}px, 0, 0)`
  }

  function translateNeighbors(dx) {
    translate(index - 1, dx + slidePos[index - 1], 0)
    translate(index, dx + slidePos[index], 0)
    translate(index + 1, dx + slidePos[index + 1], 0)
  }

  function setup(opts) {
    if (opts) Object.assign(config, opts)

    slides = element.children
    length = slides.length

    if (!length) return

    // width = container.getBoundingClientRect().width || container.offsetWidth
    width = container.clientWidth

    slidePos = new Array(length)
    element.style.width = length * width * 2 + 'px'

    for (let i = length - 1; i >= 0; i--) {
      const slide = slides[i]

      slide.style.willChange = 'transform'
      slide.style.width = width + 'px'
      slide.setAttribute('data-index', i)
      slide.style[slideDir] = i * -width + 'px'

      if (slideDir === 'right') {
        slide.style.float = 'right'
      }

      const initialDist = index > i ? -width : index < i ? width : 0
      move(i, initialDist, 0)
    }

    detachEvents()
    attachEvents()
  }

  function attachEvents() {
    const evts = [
      supports.pointerEvents ? 'pointerdown' : supports.touch ? 'touchstart' : null,
      config.draggable && !supports.pointerEvents ? 'mousedown' : null,
      'transitionend',
    ].filter(Boolean)

    evts.forEach(e => element.addEventListener(e, events))
    if (config.mousewheel) element.addEventListener('wheel', events, { passive: false })
    root.addEventListener('resize', events)
  }

  function detachEvents() {
    const t = EVENT_TYPES
    const evts = supports.pointerEvents
      ? ['pointerdown', t.pointer.move, ...t.pointer.end]
      : ['touchstart', t.touch.move, ...t.touch.end]

    evts.push('mousedown', t.mouse.move, ...t.mouse.end, 'wheel', 'transitionend')
    evts.forEach(e => element.removeEventListener(e, events))
    root.removeEventListener('resize', events)
  }

  const getPos = () => index

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
      run('callback', index, slides[index], direction)
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

      slide.style.width = ''
      slide.style[slideDir] = ''
      slide.style.transitionDuration = ''
      slide.style.transform = ''
      slide.style.willChange = ''
    }

    detachEvents()
    debouncedSetup.cancel()

    if (wheelEndTimeout) {
      clearTimeout(wheelEndTimeout)
      wheelEndTimeout = null
    }
  }

  setup()

  return {
    setup,
    slide: slideTo,
    prev,
    next,
    getPos,
    getNumSlides: () => length,
    setIndex: i => (index = i),
    appendSlide: s => (element.appendChild(s), setup()),
    prependSlide: s => (element.prepend(s), index++, setup()),
    pause: () => (config.paused = true),
    resume: () => (config.paused = false),
    kill,
  }
}

export default Swipe

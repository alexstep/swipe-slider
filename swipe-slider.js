import Swipe from './swipe3.js'

const WRAPPER = 'swipe-slider-wrapper'
const LIVE = 'swipe-slider-live'
const CLONED = 'data-cloned'

const EDITABLE = 'input, textarea, select, [contenteditable="true"]'

export default class SwipeSlider extends HTMLElement {
  constructor() {
    super()
    this.swipe = null
    this._n = 0
    this._loop = false
    this._raf = 0
    this._pendingOptions = null
    this._logicalStart = 0
    this._live = null
    this._keysBound = false
    this._onKeydown = this._onKeydown.bind(this)
  }

  connectedCallback() {
    if (!this._keysBound) {
      this.addEventListener('keydown', this._onKeydown)
      this._keysBound = true
    }
    this.init()
  }

  disconnectedCallback() {
    this.removeEventListener('keydown', this._onKeydown)
    this._keysBound = false
    this.kill()
  }

  _call(name, detail, fn, ...args) {
    this.dispatchEvent(new CustomEvent(`swipe:${name}`, { detail, bubbles: true, composed: true }))
    fn?.(...args)
  }

  _idx(el, i) {
    return Number(el?.dataset?.logicalIndex ?? i)
  }

  _logicalIndex(physicalIdx) {
    if (!this._loop || this._n < 2) return physicalIdx
    const n = this._n
    return ((physicalIdx - 2) % n + n) % n
  }

  _cancelFrame() {
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = 0
    this._pendingOptions = null
  }

  _handleLoopJump(i) {
    if (!this._loop || !this.swipe || this._n < 2) return
    const n = this._n
    const total = n + 4
    const jump = i <= 1 ? i + n : i >= total - 2 ? i - n : null
    if (jump !== null) {
      this.swipe.setIndex(jump)
      this.swipe.setup()
      this._decorateSlides()
    }
  }

  _ensureChrome() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
    if (!this.hasAttribute('aria-roledescription')) this.setAttribute('aria-roledescription', 'carousel')
    if (!this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      this.setAttribute('aria-label', 'Carousel')
    }
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')

    let live = this.querySelector(':scope > .' + LIVE)
    if (!live) {
      live = document.createElement('div')
      live.className = LIVE
      live.setAttribute('aria-live', 'polite')
      live.setAttribute('aria-atomic', 'true')
    }
    this._live = live
  }

  _ensureWrapper() {
    this._live?.remove()
    let wrapper = this.querySelector(':scope > .' + WRAPPER)
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.className = WRAPPER
      while (this.firstChild) wrapper.appendChild(this.firstChild)
      this.appendChild(wrapper)
    } else {
      wrapper.querySelectorAll(`[${CLONED}]`).forEach(node => node.remove())
    }
    this.appendChild(this._live)
    return wrapper
  }

  _realSlides(wrapper) {
    return [...wrapper.children].filter(el => !el.hasAttribute(CLONED))
  }

  _addClones(wrapper, real) {
    const n = real.length
    const make = source => {
      const clone = source.cloneNode(true)
      clone.setAttribute(CLONED, 'true')
      clone.setAttribute('aria-hidden', 'true')
      clone.inert = true
      return clone
    }
    // [clone n-2, clone n-1, ...reals, clone 0, clone 1]
    wrapper.prepend(make(real[n - 2]), make(real[n - 1]))
    wrapper.append(make(real[0]), make(real[1]))
  }

  _decorateSlides() {
    const wrapper = this.querySelector(':scope > .' + WRAPPER)
    if (!wrapper) return
    const activeBefore = document.activeElement
    const focusInside = !!(activeBefore && activeBefore !== this && this.contains(activeBefore))
    const current = this.swipe ? this.getPos() : this._logicalStart

    this._realSlides(wrapper).forEach(slide => {
      const index = Number(slide.dataset.logicalIndex)
      if (!slide.hasAttribute('role')) slide.setAttribute('role', 'group')
      if (!slide.hasAttribute('aria-roledescription')) slide.setAttribute('aria-roledescription', 'slide')
      if (!slide.hasAttribute('aria-label') || slide.dataset.swipeAutoLabel === 'true') {
        slide.setAttribute('aria-label', `Slide ${index + 1} of ${this._n}`)
        slide.dataset.swipeAutoLabel = 'true'
      }
      const active = index === current
      if (active) slide.removeAttribute('aria-hidden')
      else slide.setAttribute('aria-hidden', 'true')
      slide.inert = !active
    })

    wrapper.querySelectorAll(`[${CLONED}]`).forEach(clone => {
      clone.setAttribute('aria-hidden', 'true')
      clone.inert = true
    })

    if (focusInside && !this.contains(document.activeElement)) this.focus()
  }

  _announce(index = this.swipe ? this.getPos() : this._logicalStart) {
    if (!this._live || !this._n) return
    this._live.textContent = `Slide ${index + 1} of ${this._n}`
  }

  _onKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return
    if (event.target instanceof Element && event.target.closest(EDITABLE)) return
    const rtl = getComputedStyle(this).direction === 'rtl'
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight'
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft'
    if (event.key !== nextKey && event.key !== prevKey) return
    event.preventDefault()
    if (event.key === nextKey) this.next()
    else this.prev()
  }

  init(options = {}) {
    if (!options || typeof options !== 'object') options = {}
    this._cancelFrame()
    if (this.swipe) {
      this.swipe.kill()
      this.swipe = null
    }
    delete this.dataset.ready

    const autoH = this.getAttribute('auto-height')
    const isLoop = this.hasAttribute('loop')
    this._loop = isLoop
    this._ensureChrome()

    const wrapper = this._ensureWrapper()
    const real = this._realSlides(wrapper)
    this._n = real.length
    real.forEach((el, i) => {
      el.dataset.logicalIndex = String(i)
    })

    const attrStart = Number(this.getAttribute('start-slide') || 0)
    let logical = Number.isFinite(options.startSlide) ? options.startSlide : attrStart
    if (!Number.isFinite(logical)) logical = 0
    const max = Math.max(0, real.length - 1)
    logical = Math.min(Math.max(0, logical), max)
    this._logicalStart = logical

    let physical = logical
    if (isLoop && real.length >= 2) {
      this._addClones(wrapper, real)
      physical += 2
    }

    const user = { ...options }
    delete user.callback
    delete user.transitionEnd
    delete user.dragStart
    delete user.dragEnd
    delete user.runMove
    delete user.startSlide

    const sOpts = {
      speed: Number(this.getAttribute('speed') || 400),
      draggable: this.hasAttribute('draggable'),
      mousewheel: !this.hasAttribute('no-mousewheel'),
      disableScroll: this.hasAttribute('disable-scroll'),
      stopPropagation: this.hasAttribute('stop-propagation'),
      passive: this.hasAttribute('passive-events'),
      ...user,
      startSlide: physical,
      callback: (i, el, dir) => {
        if (autoH !== null) this.adjustHeight(el)
        this._decorateSlides()
        this._announce()
        this._call('change', { index: this._idx(el, i), element: el, direction: dir }, options.callback, i, el, dir)
      },
      transitionEnd: (i, el) => {
        this._handleLoopJump(i)
        this._call('transition-end', { index: this._idx(el, i), element: el }, options.transitionEnd, i, el)
      },
      dragStart: (i, el) => {
        this._call('drag-start', { index: this._idx(el, i), element: el }, options.dragStart, i, el)
      },
      dragEnd: (i, el) => {
        this._call('drag-end', { index: this._idx(el, i), element: el }, options.dragEnd, i, el)
      },
      runMove: () => {
        this._call('move', {}, options.runMove)
      },
    }

    this._pendingOptions = sOpts
    this._raf = requestAnimationFrame(() => {
      this._raf = 0
      const opts = this._pendingOptions
      this._pendingOptions = null
      if (!this.isConnected || !opts) return
      this.swipe = Swipe(this, opts)
      if (autoH !== null && this.swipe) {
        const active = this.swipe.getPos()
        if (wrapper.children[active]) this.adjustHeight(wrapper.children[active])
      }
      this._decorateSlides()
      this._announce()
      this.dataset.ready = 'true'
    })
  }

  _mutate(slide, where) {
    if (!(slide instanceof Element)) return
    const wrapper = this.querySelector(':scope > .' + WRAPPER)
    if (!wrapper || (!this.swipe && !this._pendingOptions)) {
      if (where === 'end') (wrapper || this).appendChild(slide)
      else (wrapper || this).prepend(slide)
      return
    }

    const logical = (this.swipe ? this.getPos() : this._logicalStart) + (where === 'start' ? 1 : 0)
    wrapper.querySelectorAll(`[${CLONED}]`).forEach(node => node.remove())
    if (where === 'end') wrapper.appendChild(slide)
    else wrapper.prepend(slide)

    const real = this._realSlides(wrapper)
    real.forEach((el, i) => {
      el.dataset.logicalIndex = String(i)
    })
    this._n = real.length
    this._logicalStart = logical

    let physical = logical
    if (this._loop && real.length >= 2) {
      this._addClones(wrapper, real)
      physical += 2
    }
    const max = Math.max(0, wrapper.children.length - 1)
    physical = Math.min(Math.max(0, physical), max)

    if (this._pendingOptions) this._pendingOptions.startSlide = physical
    if (this.swipe) {
      this.swipe.setIndex(physical)
      this.swipe.setup()
    }
    this._decorateSlides()
    this._announce()
  }

  adjustHeight(el) {
    if (!el) return
    const min = +(this.getAttribute('auto-height') || 0)
    this.style.height = Math.max(el.offsetHeight, min) + 'px'
  }

  slide(to, speed) {
    return this.swipe?.slide(this._loop && this._n >= 2 ? to + 2 : to, speed)
  }

  prev() {
    return this.swipe?.prev()
  }

  next() {
    return this.swipe?.next()
  }

  getPos() {
    if (!this.swipe) return this._logicalStart
    return this._logicalIndex(this.swipe.getPos())
  }

  getNumSlides() {
    return this._n
  }

  kill() {
    this._cancelFrame()
    if (this.swipe) {
      this.swipe.kill()
      this.swipe = null
    }
    this.querySelector(':scope > .' + WRAPPER)?.querySelectorAll(`[${CLONED}]`).forEach(node => node.remove())
    this._n = 0
    this._loop = false
    this._logicalStart = 0
    if (this._live) this._live.textContent = ''
    delete this.dataset.ready
  }

  setup(options) {
    this.swipe?.setup(options)
    this._decorateSlides()
  }

  appendSlide(slide) {
    this._mutate(slide, 'end')
  }

  prependSlide(slide) {
    this._mutate(slide, 'start')
  }
}

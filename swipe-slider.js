import Swipe from './swipe3.js'

const WRAPPER = 'swipe-slider-wrapper'
const CLONED = 'data-cloned'

export default class SwipeSlider extends HTMLElement {
  constructor() {
    super()
    this.swipe = null
    this._n = 0
    this._loop = false
  }

  connectedCallback() {
    this.init()
  }
  disconnectedCallback() {
    this.kill()
  }

  _call(name, detail, fn, ...args) {
    this.dispatchEvent(new CustomEvent(`swipe:${name}`, { detail, bubbles: true }))
    fn?.(...args)
  }

  _idx(el, i) {
    return Number(el?.dataset?.logicalIndex ?? i)
  }

  _logicalIndex(physicalIdx) {
    if (!this._loop) return physicalIdx
    const n = this._n
    return (((physicalIdx - 2) % n) + n) % n
  }

  _handleLoopJump(i) {
    if (!this._loop || !this.swipe) return
    const n = this._n
    const total = n + 4
    const jump = i <= 1 ? i + n : i >= total - 2 ? i - n : null
    if (jump !== null) {
      this.swipe.setIndex(jump)
      this.swipe.setup()
    }
  }

  init(options = {}) {
    if (this.swipe) this.kill()

    const attrs = {
      autoH: this.getAttribute('auto-height'),
      isLoop: this.hasAttribute('loop'),
      start: +(this.getAttribute('start-slide') || 0),
      speed: +(this.getAttribute('speed') || 400),
      draggable: this.hasAttribute('draggable'),
      mousewheel: !this.hasAttribute('no-mousewheel'),
      disableScroll: this.hasAttribute('disable-scroll'),
      stopPropagation: this.hasAttribute('stop-propagation'),
      passive: this.hasAttribute('passive-events'),
    }
    this._loop = attrs.isLoop

    const sOpts = {
      startSlide: attrs.start,
      speed: attrs.speed,
      draggable: attrs.draggable,
      mousewheel: attrs.mousewheel,
      disableScroll: attrs.disableScroll,
      stopPropagation: attrs.stopPropagation,
      passive: attrs.passive,
      ...options,
      callback: (i, el, dir) => {
        if (attrs.autoH !== null) this.adjustHeight(el)
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

    let wrapper = this.querySelector('.' + WRAPPER)
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.className = WRAPPER
      let i = 0
      while (this.firstChild) {
        const child = this.firstChild
        child.dataset && (child.dataset.logicalIndex = String(i++))
        wrapper.appendChild(child)
      }
      this.appendChild(wrapper)
    } else {
      wrapper.querySelectorAll(`[${CLONED}]`).forEach(c => c.remove())
      ;[...wrapper.children].forEach((c, i) => {
        c.dataset && !c.dataset.logicalIndex && (c.dataset.logicalIndex = String(i))
      })
    }

    const realSlides = [...wrapper.children].filter(c => !c.hasAttribute(CLONED))
    this._n = realSlides.length

    if (attrs.isLoop && realSlides.length >= 2) {
      const n = realSlides.length
      const clones = [realSlides[n - 2], realSlides[n - 1], realSlides[0], realSlides[1]].map(s => {
        const clone = s.cloneNode(true)
        clone.setAttribute(CLONED, 'true')
        return clone
      })
      wrapper.prepend(clones[0], clones[1])
      wrapper.append(clones[2], clones[3])
      sOpts.startSlide = attrs.start + 2
    }

    requestAnimationFrame(() => {
      this.swipe = new Swipe(this, sOpts)
      if (attrs.autoH !== null) {
        const active = this.swipe?.getPos()
        if (active !== undefined && wrapper.children[active]) this.adjustHeight(wrapper.children[active])
      }
      this.dataset.ready = 'true'
    })
  }

  adjustHeight(el) {
    if (!el) return
    const min = +(this.getAttribute('auto-height') || 0)
    this.style.height = Math.max(el.offsetHeight, min) + 'px'
  }

  slide(to, s) {
    return this.swipe?.slide(this._loop ? to + 2 : to, s)
  }
  prev() {
    return this.swipe?.prev()
  }
  next() {
    return this.swipe?.next()
  }
  getPos() {
    return this._logicalIndex(this.swipe?.getPos() ?? 0)
  }
  getNumSlides() {
    return this._n
  }
  kill() {
    if (this.swipe) {
      this.swipe.kill()
      this.swipe = null
    }
    this.querySelector('.' + WRAPPER)?.querySelectorAll(`[${CLONED}]`).forEach(c => c.remove())
    this._n = 0
    this._loop = false
    delete this.dataset.ready
  }
  setup(o) {
    this.swipe?.setup(o)
  }
  appendSlide(s) {
    this.swipe?.appendSlide(s)
  }
  prependSlide(s) {
    this.swipe?.prependSlide(s)
  }
}

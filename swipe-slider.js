import Swipe from './swipe3.js'

/**
 * Universal Swipe Slider Web Component
 * Wrapper around swipe.js
 */
export default class SwipeSlider extends HTMLElement {
  constructor() {
    super()
    this.swipe = null
  }

  connectedCallback() {
    this.init()
  }
  disconnectedCallback() {
    this.kill()
  }

  _emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(`swipe:${name}`, { detail, bubbles: true }))
  }

  _idx(el, i) {
    const li = el?.dataset?.logicalIndex
    return li !== undefined ? +li : i
  }

  init(options = {}) {
    if (this.swipe) this.kill()

    const get = a => this.getAttribute(a)
    const has = a => this.hasAttribute(a)
    const autoH = get('auto-height')
    const isLoop = has('loop')

    const sOpts = {
      startSlide: +(get('start-slide') || 0),
      speed: +(get('speed') || 400),
      draggable: has('draggable'),
      mousewheel: !has('no-mousewheel'),
      disableScroll: has('disable-scroll'),
      stopPropagation: has('stop-propagation'),
      passive: has('passive-events'),
      ...options,
      callback: (i, el, dir) => {
        if (autoH !== null) this.adjustHeight(el)

        if (isLoop && this.swipe) {
          const total = this.swipe.getNumSlides()
          const method = i === total - 1 ? 'appendSlide' : i === 0 ? 'prependSlide' : null
          if (method) {
            const wrapper = this.querySelector('.swipe-slider-wrapper')
            const slide = method[0] === 'a' ? wrapper?.firstElementChild : wrapper?.lastElementChild
            if (slide) this[method](slide)
          }
        }

        this._emit('change', { index: this._idx(el, i), element: el, direction: dir })
        options.callback?.(i, el, dir)
      },
      transitionEnd: (i, el) => {
        this._emit('transition-end', { index: i, element: el })
        options.transitionEnd?.(i, el)
      },
      dragStart: (i, el) => {
        this._emit('drag-start', { index: i, element: el })
        options.dragStart?.(i, el)
      },
      dragEnd: (i, el) => {
        this._emit('drag-end', { index: i, element: el })
        options.dragEnd?.(i, el)
      },
      runMove: () => {
        this._emit('move')
        options.runMove?.()
      },
    }

    let wrapper = this.querySelector('.swipe-slider-wrapper')
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.className = 'swipe-slider-wrapper'
      let i = 0
      while (this.firstChild) {
        const child = this.firstChild
        if (child instanceof HTMLElement) child.dataset.logicalIndex = String(i++)
        wrapper.appendChild(child)
      }
      this.appendChild(wrapper)
    } else {
      ;[...wrapper.children].forEach((c, i) => {
        if (c instanceof HTMLElement && !c.dataset.logicalIndex) c.dataset.logicalIndex = String(i)
      })
    }

    if (isLoop && wrapper.children.length > 1) {
      const first = wrapper.firstElementChild
      const last = wrapper.lastElementChild
      if (sOpts.startSlide === 0 && last) {
        wrapper.prepend(last)
        sOpts.startSlide = 1
      } else if (sOpts.startSlide === wrapper.children.length - 1 && first) {
        wrapper.append(first)
        sOpts.startSlide = wrapper.children.length - 2
      }
    }

    requestAnimationFrame(() => {
      // @ts-ignore
      this.swipe = new Swipe(this, sOpts)
      if (autoH !== null) {
        const slides = this.querySelectorAll('.swipe-slider-wrapper > *')
        const active = this.swipe?.getPos()
        if (active !== undefined && slides[active]) this.adjustHeight(slides[active])
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
    return this.swipe?.slide(to, s)
  }
  prev() {
    if (this.hasAttribute('loop') && this.swipe?.getPos() === 0) {
      const s = this.querySelector('.swipe-slider-wrapper')?.lastElementChild
      if (s instanceof HTMLElement) this.prependSlide(s)
    }
    return this.swipe?.prev()
  }
  next() {
    if (this.hasAttribute('loop') && this.swipe?.getPos() === this.swipe?.getNumSlides() - 1) {
      const s = this.querySelector('.swipe-slider-wrapper')?.firstElementChild
      if (s instanceof HTMLElement) this.appendSlide(s)
    }
    return this.swipe?.next()
  }
  getPos() {
    const i = this.swipe ? this.swipe.getPos() : 0
    const slides = this.querySelectorAll('.swipe-slider-wrapper > *')
    return this._idx(slides[i], i)
  }
  getNumSlides() {
    return this.swipe?.getNumSlides()
  }
  kill() {
    if (this.swipe) {
      this.swipe.kill()
      this.swipe = null
    }
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

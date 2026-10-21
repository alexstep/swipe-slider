import { test, expect } from '@playwright/test'

async function mount(page, { slides = 3, attrs = '', inner = '', dir = 'ltr' } = {}) {
  await page.goto('/tests/fixtures/harness.html')
  await page.evaluate(({ slides, attrs, inner, dir }) => {
    document.documentElement.setAttribute('dir', dir)
    const html = inner || Array.from({ length: slides }, (_, i) => `<div class="slide">Slide ${i + 1}</div>`).join('')
    document.getElementById('root').innerHTML = `<swipe-slider ${attrs}>${html}</swipe-slider>`
  }, { slides, attrs, inner, dir })
  const slider = page.locator('swipe-slider')
  await expect(slider).toHaveAttribute('data-ready', 'true', { timeout: 3000 })
  await expect.poll(() => slider.evaluate(el => el.clientWidth)).toBeGreaterThan(0)
  return slider
}

async function drag(page, slider, dx) {
  const box = await slider.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 12 })
  await page.mouse.up()
}

async function offsets(slider) {
  return slider.evaluate(el => {
    const box = el.getBoundingClientRect()
    return [...el.querySelectorAll('.slide')]
      .filter(slide => !slide.hasAttribute('data-cloned'))
      .map(slide => Math.round(slide.getBoundingClientRect().left - box.left))
  })
}

test.beforeEach(async ({ page }) => {
  page._errors = []
  page.on('pageerror', error => page._errors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(page._errors).toEqual([])
})

test('renders slides and carousel semantics', async ({ page }) => {
  const slider = await mount(page, { attrs: 'aria-label="Photos"' })
  await expect(slider).toHaveAttribute('role', 'region')
  await expect(slider).toHaveAttribute('aria-roledescription', 'carousel')
  await expect(slider).toHaveAttribute('aria-label', 'Photos')
  await expect(slider).toHaveAttribute('tabindex', '0')

  const labels = await slider.locator('.slide').evaluateAll(nodes =>
    nodes.filter(node => !node.hasAttribute('data-cloned')).map(node => ({
      label: node.getAttribute('aria-label'),
      role: node.getAttribute('role'),
      description: node.getAttribute('aria-roledescription'),
      hidden: node.getAttribute('aria-hidden'),
    })),
  )
  expect(labels).toEqual([
    { label: 'Slide 1 of 3', role: 'group', description: 'slide', hidden: null },
    { label: 'Slide 2 of 3', role: 'group', description: 'slide', hidden: 'true' },
    { label: 'Slide 3 of 3', role: 'group', description: 'slide', hidden: 'true' },
  ])
  await expect(slider.locator('.swipe-slider-live')).toHaveText('Slide 1 of 3')
  expect(await slider.evaluate(el => el.getNumSlides())).toBe(3)
  expect(await slider.evaluate(el => el.getPos())).toBe(0)

  const easing = await slider.evaluate(el => getComputedStyle(el).getPropertyValue('--swipe-easing').trim())
  expect(easing).toContain('cubic-bezier')
})

test('keeps an author-provided slide label', async ({ page }) => {
  const slider = await mount(page, {
    inner: '<div class="slide" aria-label="Cover">A</div><div class="slide">B</div>',
  })
  const labels = await slider.locator('.slide').evaluateAll(nodes =>
    nodes.filter(node => !node.hasAttribute('data-cloned')).map(node => node.getAttribute('aria-label')),
  )
  expect(labels).toEqual(['Cover', 'Slide 2 of 2'])
})

test('starts at start-slide', async ({ page }) => {
  const slider = await mount(page, { attrs: 'start-slide="1"' })
  expect(await slider.evaluate(el => el.getPos())).toBe(1)
  await expect(slider.locator('.swipe-slider-live')).toHaveText('Slide 2 of 3')
})

test('moves with a pointer drag and emits events', async ({ page }) => {
  const slider = await mount(page, { attrs: 'draggable speed="40"' })
  await slider.evaluate(el => {
    el.__seen = []
    for (const name of ['swipe:drag-start', 'swipe:change', 'swipe:drag-end', 'swipe:transition-end', 'swipe:move']) {
      el.addEventListener(name, event => {
        el.__seen.push({
          name,
          index: event.detail.index,
          direction: event.detail.direction,
          bubbles: event.bubbles,
          composed: event.composed,
        })
      })
    }
  })

  await drag(page, slider, -240)
  await expect.poll(() => slider.evaluate(el => el.__seen.some(item => item.name === 'swipe:transition-end'))).toBe(true)

  const seen = await slider.evaluate(el => el.__seen)
  expect(seen.map(item => item.name)).toEqual(expect.arrayContaining([
    'swipe:drag-start',
    'swipe:move',
    'swipe:change',
    'swipe:drag-end',
    'swipe:transition-end',
  ]))
  const change = seen.find(item => item.name === 'swipe:change')
  expect(change).toMatchObject({ index: 1, direction: -1, bubbles: true, composed: true })
  expect(await slider.evaluate(el => el.getPos())).toBe(1)
  await expect(slider.locator('.swipe-slider-live')).toHaveText('Slide 2 of 3')
})

test('does not drag with the mouse unless draggable is set', async ({ page }) => {
  const slider = await mount(page, { attrs: 'speed="0"' })
  await drag(page, slider, -240)
  expect(await slider.evaluate(el => el.getPos())).toBe(0)
})

test('drags while passive-events is set', async ({ page }) => {
  const slider = await mount(page, { attrs: 'draggable passive-events speed="0"' })
  await drag(page, slider, -240)
  await expect.poll(() => slider.evaluate(el => el.getPos())).toBe(1)
})

test('navigates with arrow keys and does not wrap', async ({ page }) => {
  const slider = await mount(page, { attrs: 'speed="0"' })
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => slider.evaluate(el => el.getPos())).toBe(1)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => slider.evaluate(el => el.getPos())).toBe(0)
  await page.keyboard.press('ArrowLeft')
  expect(await slider.evaluate(el => el.getPos())).toBe(0)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  expect(await slider.evaluate(el => el.getPos())).toBe(2)
  await expect(slider.locator('.swipe-slider-live')).toHaveText('Slide 3 of 3')
})

test('ignores arrow keys inside editable controls', async ({ page }) => {
  const slider = await mount(page, {
    attrs: 'speed="0"',
    inner: '<div class="slide"><input aria-label="Name"></div><div class="slide">B</div>',
  })
  await slider.locator('input').focus()
  await page.keyboard.press('ArrowRight')
  expect(await slider.evaluate(el => el.getPos())).toBe(0)
})

test('reverses arrow keys and drag in RTL', async ({ page }) => {
  const slider = await mount(page, { attrs: 'draggable speed="0"', dir: 'rtl' })
  const before = await offsets(slider)
  expect(Math.abs(before[0])).toBeLessThan(2)
  expect(before[1]).toBeLessThan(-100)

  await slider.focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => slider.evaluate(el => el.getPos())).toBe(1)
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => slider.evaluate(el => el.getPos())).toBe(0)

  await drag(page, slider, 240)
  await expect.poll(() => slider.evaluate(el => el.getPos())).toBe(1)
})

test('loops back to the first slide', async ({ page }) => {
  const slider = await mount(page, { attrs: 'loop speed="30"' })
  expect(await slider.evaluate(el => el.querySelectorAll('[data-cloned]').length)).toBe(4)
  expect(await slider.evaluate(el => el.getNumSlides())).toBe(3)

  for (const expected of [1, 2, 0]) {
    const pos = await slider.evaluate(el => new Promise(resolve => {
      el.addEventListener('swipe:transition-end', () => resolve(el.getPos()), { once: true })
      el.next()
    }))
    expect(pos).toBe(expected)
  }
})

test('appends, prepends, and replaces slides at runtime', async ({ page }) => {
  const slider = await mount(page, { attrs: 'speed="0"' })
  await slider.evaluate(el => {
    const node = document.createElement('div')
    node.className = 'slide'
    node.textContent = 'Four'
    el.appendSlide(node)
  })
  expect(await slider.evaluate(el => el.getNumSlides())).toBe(4)
  await slider.evaluate(el => el.slide(3))
  await expect.poll(() => slider.evaluate(el => el.getPos())).toBe(3)
  await expect(slider.locator('.swipe-slider-live')).toHaveText('Slide 4 of 4')

  await slider.evaluate(el => {
    const node = document.createElement('div')
    node.className = 'slide'
    node.textContent = 'Zero'
    el.prependSlide(node)
  })
  expect(await slider.evaluate(el => el.getNumSlides())).toBe(5)
  expect(await slider.evaluate(el => el.getPos())).toBe(4)

  await slider.evaluate(el => {
    el.innerHTML = '<div class="slide">Only</div><div class="slide">Two</div>'
    el.init()
  })
  await expect(slider).toHaveAttribute('data-ready', 'true')
  expect(await slider.evaluate(el => el.getNumSlides())).toBe(2)
  expect(await slider.evaluate(el => el.getPos())).toBe(0)
  await expect(slider.locator('.swipe-slider-live')).toHaveText('Slide 1 of 2')
})

test('finishes immediately when the user prefers reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const slider = await mount(page, { attrs: 'speed="500"' })
  const pos = await slider.evaluate(el => new Promise(resolve => {
    el.addEventListener('swipe:transition-end', () => resolve(el.getPos()), { once: true })
    el.next()
  }))
  expect(pos).toBe(1)
  const duration = await slider.locator('.slide').first().evaluate(el => getComputedStyle(el).transitionDuration)
  expect(['0s', '0ms']).toContain(duration)
})

test('clamps slide() without loop and wraps logical indexes with loop', async ({ page }) => {
  const bounded = await mount(page, { attrs: 'speed="0"' })
  await bounded.evaluate(el => el.slide(99))
  await expect.poll(() => bounded.evaluate(el => el.getPos())).toBe(2)
  await expect(bounded.locator('.swipe-slider-live')).toHaveText('Slide 3 of 3')
  await bounded.evaluate(el => el.slide(-4))
  await expect.poll(() => bounded.evaluate(el => el.getPos())).toBe(0)

  const looped = await mount(page, { attrs: 'loop speed="0"' })
  await looped.evaluate(el => el.slide(5))
  await expect.poll(() => looped.evaluate(el => el.getPos())).toBe(2)
  await looped.evaluate(el => el.slide(-1))
  await expect.poll(() => looped.evaluate(el => el.getPos())).toBe(2)
})

test('does not drop a burst of next and prev while looping', async ({ page }) => {
  const slider = await mount(page, { attrs: 'loop speed="0"' })
  const pos = await slider.evaluate(async el => {
    const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    for (let i = 0; i < 5; i++) el.next()
    await frames()
    const afterNext = el.getPos()
    for (let i = 0; i < 5; i++) el.prev()
    await frames()
    return { afterNext, afterPrev: el.getPos() }
  })
  expect(pos).toEqual({ afterNext: 2, afterPrev: 0 })
})

test('does not emit a slide that was cancelled by kill', async ({ page }) => {
  const slider = await mount(page, { attrs: 'speed="0"' })
  const seen = await slider.evaluate(async el => {
    const names = []
    el.addEventListener('swipe:change', () => names.push('change'))
    el.addEventListener('swipe:transition-end', () => names.push('end'))
    el.next()
    el.kill()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return names
  })
  expect(seen).toEqual([])
  expect(await slider.evaluate(el => el.swipe)).toBeNull()
})

test('does not copy ids onto loop clones', async ({ page }) => {
  await mount(page, {
    attrs: 'loop',
    inner: '<div class="slide" id="cover"><h2 id="cover-title">A</h2></div><div class="slide" id="more">B</div>',
  })
  const ids = await page.evaluate(() => ({
    cover: document.querySelectorAll('#cover').length,
    title: document.querySelectorAll('#cover-title').length,
    more: document.querySelectorAll('#more').length,
    cloned: document.querySelectorAll('[data-cloned][id], [data-cloned] [id]').length,
  }))
  expect(ids).toEqual({ cover: 1, title: 1, more: 1, cloned: 0 })
})

test('does not steal arrows from buttons, links, or slider widgets', async ({ page }) => {
  const slider = await mount(page, {
    attrs: 'speed="0"',
    inner: '<div class="slide"><button type="button">Open</button><a href="#next">Next</a><div role="slider" tabindex="0" aria-label="Volume"></div></div><div class="slide">B</div>',
  })
  for (const selector of ['button', 'a', '[role="slider"]']) {
    await slider.locator(selector).focus()
    await page.keyboard.press('ArrowRight')
    expect(await slider.evaluate(el => el.getPos())).toBe(0)
  }
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => slider.evaluate(el => el.getPos())).toBe(1)
})

test('suppresses the click that follows a drag but keeps a tap', async ({ page }) => {
  const slider = await mount(page, {
    attrs: 'draggable speed="0"',
    inner: '<div class="slide"><button type="button">Go</button></div><div class="slide">Next</div>',
  })
  await slider.evaluate(el => {
    el.__clicks = 0
    el.addEventListener('click', () => { el.__clicks++ })
  })
  await slider.locator('button').click()
  expect(await slider.evaluate(el => el.__clicks)).toBe(1)

  await drag(page, slider, -240)
  await page.waitForTimeout(50)
  expect(await slider.evaluate(el => el.__clicks)).toBe(1)
  expect(await slider.evaluate(el => el.getPos())).toBe(1)

  await slider.locator('.slide').nth(1).click()
  expect(await slider.evaluate(el => el.__clicks)).toBe(2)
})

test('does not select text during a mouse drag', async ({ page }) => {
  const slider = await mount(page, {
    attrs: 'draggable speed="0"',
    inner: '<div class="slide"><p>Selectable words in the first slide</p></div><div class="slide">B</div>',
  })
  const box = await slider.boundingBox()
  await page.mouse.move(box.x + 30, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(box.x + 220, box.y + 40, { steps: 8 })
  const during = await page.evaluate(() => ({
    selected: window.getSelection().toString(),
    userSelect: getComputedStyle(document.querySelector('.swipe-slider-wrapper')).userSelect,
    willChange: document.querySelector('.slide').style.willChange,
  }))
  await page.mouse.up()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const after = await slider.locator('.swipe-slider-wrapper').evaluate(el => getComputedStyle(el).userSelect)
  const willAfter = await slider.locator('.slide').first().evaluate(el => getComputedStyle(el).willChange)
  expect(during.selected).toBe('')
  expect(during.userSelect).toBe('none')
  expect(during.willChange).toBe('transform')
  expect(after).toBe('auto')
  expect(willAfter).toBe('auto')
})

test('ignores wheel gestures that start on the ignore selector', async ({ page }) => {
  const slider = await mount(page, {
    attrs: 'speed="0"',
    inner: '<div class="slide"><button type="button">Skip</button></div><div class="slide">B</div><div class="slide">C</div>',
  })
  await slider.evaluate(el => el.init({ ignore: 'button', speed: 0 }))
  await expect(slider).toHaveAttribute('data-ready', 'true')

  await slider.locator('button').hover()
  await page.mouse.wheel(500, 0)
  await page.waitForTimeout(120)
  expect(await slider.evaluate(el => el.getPos())).toBe(0)

  const box = await slider.boundingBox()
  await page.mouse.move(box.x + 16, box.y + 12)
  await page.mouse.wheel(500, 0)
  await expect.poll(() => slider.evaluate(el => el.getPos()), { timeout: 1000 }).toBe(1)
})

test('does not keep will-change on an idle slider', async ({ page }) => {
  const slider = await mount(page)
  expect(await slider.evaluate(el => getComputedStyle(el).willChange)).toBe('auto')
  expect(await slider.locator('.slide').first().evaluate(el => getComputedStyle(el).willChange)).toBe('auto')
})

test('follows the host width through ResizeObserver', async ({ page }) => {
  const slider = await mount(page)
  await slider.evaluate(el => { el.style.width = '200px' })
  await expect.poll(() => slider.locator('.slide').first().evaluate(el => el.style.width)).toBe('200px')
})

test('does not attach the engine after a disconnect', async ({ page }) => {
  await page.goto('/tests/fixtures/harness.html')
  const leaked = await page.evaluate(async () => {
    const el = document.createElement('swipe-slider')
    el.innerHTML = '<div class="slide">A</div><div class="slide">B</div>'
    document.body.appendChild(el)
    el.remove()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    window.dispatchEvent(new Event('resize'))
    return !!(el.swipe || el.dataset.ready)
  })
  expect(leaked).toBe(false)
})

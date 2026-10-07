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

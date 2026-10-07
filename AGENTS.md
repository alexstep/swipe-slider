# AGENTS.md

Инструкции для облачных и локальных агентов репозитория `pure-swipe-slider` (`<swipe-slider>`).

## Ограничения

- Не менять публичный API: имена атрибутов, событий `swipe:*`, методов и смысл их аргументов.
- Не поднимать версию в `package.json` и не публиковать пакет, пока об этом явно не попросили. Публикация — только workflow `.github/workflows/publish.yml` по тегу `vX.Y.Z`, совпадающему с `version`. Теги, релизы и `npm publish` сам не создавай.
- Не пушить в `main`. Рабочая ветка — `cursor/<описание>-9ab8`, один PR.
- Без фреймворков и тяжёлых runtime-зависимостей. В рантайме только браузерные API.
- Бандл должен оставаться крошечным. Новый код — в `swipe-slider.js` и `swipe3.js`, без новых production-зависимостей.
- Не ломать light DOM: слайды — прямые дети элемента, пользовательский CSS должен их доставать. Shadow DOM и `::part` не добавлять.

## Как устроено

- `swipe-slider.js` — custom element. Слайды переносятся в `.swipe-slider-wrapper`. При `loop` (от двух слайдов) трек выглядит так: `[клон n-2, клон n-1, ...реальные, клон 0, клон 1]`. Клоны помечены `data-cloned`.
- `swipe3.js` — низкоуровневый движок. Берёт **первого element-child** контейнера как трек. Публичный вызов: `Swipe(container, options)`.
- `register.js` — `customElements.define('swipe-slider', ...)` и импорт CSS для бандлеров. В браузере без бандлера CSS подключают тегом `<link>`.
- `demo.html` грузит исходники, не `dist/`. `dist/` обновляется только `npm run build` (нужны bun и brotli) и может отставать от исходников.
- Готовность: атрибут `data-ready="true"` выставляется на следующем кадре после `init()`. До этого `el.swipe === null`.

## Запуск

```bash
npm ci
npx playwright install --with-deps chromium
npm test
```

Демо: открыть `demo.html` (статический файл; модули грузятся по относительному пути). Тестовый сервер — `node tests/static-server.js` на `127.0.0.1:4173`, его поднимает Playwright.

Cloud Agent: `.cursor/environment.json` ставит зависимости и Chromium (`npm ci && npx playwright install --with-deps chromium`). Отдельный `start` не нужен.

## Публичный API элемента

Регистрация тега не входит в класс. Тег по умолчанию — `swipe-slider` через `register.js`. Класс можно повесить на другое имя.

### Атрибуты

Булевы атрибуты включаются присутствием.

| Атрибут | По умолчанию | Смысл |
|---------|--------------|--------|
| `start-slide` | `0` | Начальный логический индекс. |
| `speed` | `400` | Длительность перехода, мс. При `prefers-reduced-motion: reduce` движок подставляет `0`. |
| `draggable` | выкл | Разрешает перетаскивание мышью. Touch и pen работают без атрибута. |
| `no-mousewheel` | выкл | Выключает колесо. Колесо включено, пока атрибута нет. Атрибут `mousewheel` движок не читает. |
| `disable-scroll` | выкл | Запрещает вертикальный скролл, начатый на слайдере. В CSS ещё `touch-action: none`. |
| `stop-propagation` | выкл | `stopPropagation` на событиях движка. |
| `passive-events` | выкл | `pointermove` / `touchmove` / `wheel` вешаются как passive, `preventDefault` не вызывается. |
| `loop` | выкл | Бесконечная лента клонами. Нужно минимум 2 реальных слайда. |
| `auto-height` | выкл | Высота хоста = высота активного слайда. Число в значении — минимальная высота в px. |

### Свойства и методы

- `swipe` — экземпляр движка или `null` (до кадра инициализации и после `kill()`).
- `init(options?)` — пересобрать трек из текущих детей. `options.startSlide` — **логический** индекс.
- `slide(to, speed?)`, `prev()`, `next()` — `to` логический. Без `loop` края не зацикливаются.
- `getPos()` — логический индекс. `getNumSlides()` — число реальных слайдов, без клонов.
- `kill()` — снять слушатели, клоны и экземпляр. `setup(options?)` — переизмерить движок.
- `appendSlide(element)`, `prependSlide(element)` — вставляют реальный слайд и сохраняют текущий логический слайд на экране (после prepend индекс сдвигается на +1).
- `adjustHeight(element)`.

Колбэки внутри `init(options)` (`callback`, `transitionEnd`, `dragStart`, `dragEnd`, `runMove`) — это колбэки движка, им приходит **физический** индекс. События `swipe:*` отдают **логический** индекс. Так было и раньше, не «исправлять».

### События

Все `CustomEvent`, `{ bubbles: true, composed: true }`.

| Событие | `detail` |
|---------|----------|
| `swipe:change` | `{ index, element, direction }` |
| `swipe:transition-end` | `{ index, element }` |
| `swipe:drag-start` | `{ index, element }` |
| `swipe:drag-end` | `{ index, element }` |
| `swipe:move` | `{}` |

`direction`: **-1 — к следующему индексу, 1 — к предыдущему**. Это знак оригинального Swipe.js, не «1 = next». Не инвертировать.

При `speed: 0` и при `prefers-reduced-motion` браузер не шлёт `transitionend`. Движок сам вызывает `transitionEnd`, чтобы `swipe:transition-end` не пропадал.

### Клавиатура и ARIA

Не перетирать авторские `role`, `aria-*`, `tabindex`, `aria-label` слайда.

- Хост: `role="region"`, `aria-roledescription="carousel"`, имя (`aria-label="Carousel"`, только если своего нет), `tabindex="0"`.
- Реальный слайд: `role="group"`, `aria-roledescription="slide"`, `aria-label="Slide N of M"` (если лейбл не задан автором; свои лейблы помечены `data-swipe-auto-label`).
- Неактивные слайды: `aria-hidden="true"` и `inert`. Клоны всегда скрыты.
- Живой регион: `.swipe-slider-live` (`aria-live="polite"`), текст `Slide N of M`.
- Стрелки: в LTR ArrowRight = next, ArrowLeft = prev; в RTL наоборот. Игнорируются в `input`, `textarea`, `select`, `[contenteditable=true]`, и если уже был `preventDefault`.

### CSS

Light DOM, **`::part` нет** — для него нужен shadow root, а он сломает стилизацию снаружи.

| Custom property | По умолчанию |
|-----------------|--------------|
| `--swipe-easing` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` |
| `--swipe-height-duration` | `0.2s` (`0s` при reduced motion) |

Классы: хост `swipe-slider`, трек `.swipe-slider-wrapper`, анонс `.swipe-slider-live`.

### Движок `swipe3.js`

Опции: `speed`, `startSlide`, `draggable`, `mousewheel`, `disableScroll`, `stopPropagation`, `ignore`, `passive`, `paused` и колбэки выше.

Методы возврата: `setup`, `slide`, `prev`, `next`, `getPos`, `getNumSlides`, `setIndex`, `appendSlide`, `prependSlide`, `pause`, `resume`, `kill`.

Жесты идут через Pointer Events (`pointerdown` passive, `pointermove` passive только при `passive: true`). Отдельные touch/mouse остаются запасным путём, если `PointerEvent` нет. `pointerleave` жест не обрывает. `draggable` ограничивает только `pointerType === "mouse"`.

RTL: `direction: rtl` на хосте или предке. Трек `.swipe-slider-wrapper` всегда `direction: ltr`, чтобы float не прилипал к правому краю широкой ленты; у слайдов направление текста возвращается. `translate3d` и дельта указателя зеркалятся: следующий слайд слева, жест к нему — вправо, ArrowLeft = next.

`ignore` — CSS-селектор. Жест, начатый внутри совпадения (`closest`), пропускается.

## Проверки перед сдачей

`npm test` (Playwright, Chromium): рендер и ARIA, свайп, клавиатура, RTL, события, `appendSlide` / `prependSlide` / `init()`, `loop`, reduced motion, отсутствие утечки после `disconnectedCallback`.

Типы: `swipe-slider.d.ts`, `swipe3.d.ts`. Манифест: `custom-elements.json` (поле `customElements` в `package.json`).

## Чего здесь нет специально

Автоплей, точки, виртуализация, наблюдатель атрибутов после `init()` (демо пересоздаёт элемент), отдельная сборка `dist/` в CI. Атрибуты, изменённые после инициализации, подхватываются следующим `init()` или новым элементом.

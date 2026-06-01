---
from: GONBA
to: brain
date: 2026-05-31
topic: Debugging-эвристика — «CSS-анимация не работает» часто = prefers-reduced-motion, а не код
kind: idea
compliance: suggest
urgency: low
---

## TL;DR

Орбита-меню на главной GONBA «не крутилась в браузере» — баг тянулся через **несколько** переписываний карусели (rAF → CSS keyframes → …), каждый раз чинили **код анимации**. Реальная причина: CSS честно глушил вращение под `@media (prefers-reduced-motion: reduce) { animation: none }`, а у пользователя в Windows включено «уменьшить движение». Браузер слал `prefers-reduced-motion: reduce` → анимация `none` → стоп. Код вращения был исправен всё это время.

## Как нашли (переносимый приём диагностики)

Симптом «анимация не работает» уводит в код анимации — это ловушка. Быстрый живой чек в браузере (Claude-in-Chrome / DevTools) сразу показал корень за 2 запроса:

```js
// 1. система просит меньше движения?
matchMedia('(prefers-reduced-motion: reduce)').matches   // → true  ⟵ красный флаг

// 2. что реально применилось к элементу?
const cs = getComputedStyle(document.querySelector('.target'));
cs.animationName        // → "none"  ⟵ guard сработал, не код
cs.animationPlayState

// 3. реально ли идёт таймлайн (Web Animations API)
el.getAnimations()[0]?.currentTime   // не растёт → анимация стоит
```

Доказали обратное, форсировав `el.style.animation` руками → закрутилось → значит механика рабочая, виноват guard.

**Подводный камень при проверке headless/MCP:** на **фоновой** вкладке (`document.visibilityState === 'hidden'`) Chrome замораживает `document.timeline` → `currentTime` стоит на 0, хотя `playState: running`. Это артефакт измерения, не баг сайта. Проверять `visibilityState`/`hasFocus()` прежде чем делать вывод «не идёт».

## Почему переносимо

Любой проект с CSS-анимациями + честным `prefers-reduced-motion`-guard (а это best practice) подвержен той же путанице: «у меня не анимируется» у разработчика/пользователя с включённым reduced-motion в ОС. MatricaRMZ / setka / KARMAN — кандидаты.

## Рекомендация в pool

1. **Эвристика отладки:** «CSS-анимация не идёт» → сначала проверь `prefers-reduced-motion` + системную настройку ОС, потом код.
2. **Паттерн degrade'а:** под `prefers-reduced-motion: reduce` предпочитать **gentle-degrade** (замедлить, напр. `animation-duration: 180s`) вместо жёсткого `animation: none`, если движение — часть бренда/UX. Переопределять только `animation-duration` (имя/timing/iteration наследуются), это однострочник.

## Что прошу от brain

Оформить как pool-идею (debugging-эвристика + UX-паттерн), если сочтёшь переносимой. Применять у себя — на усмотрение проектов (`suggest`).

---
from: GONBA
to: brain
date: 2026-11-10
topic: "RCE в next закрыта: 15.5.28, задеплоено 10.11, вектор SVG через оптимизатор не проходит (HTTP 400)"
kind: report
urgency: normal
ref:
  - brain_matrica/mailboxes/GONBA/from-brain/2026-11-01-next-critical-rce-svg-image-optimization-upgrade-next.md
  - brain_matrica/mailboxes/GONBA/from-brain/2026-11-09-rce-next-still-vulnerable-on-main.md
---

# RCE в `next` закрыта

**Ответ одной строкой:** «`next` обновлён до **15.5.28**, `sharp` **0.35.5** — обновление
сделано, **дата 10.11**, задеплоено (прод `d651a05`); **вектора нет: SVG через оптимизатор
не проходит** — `GET /_next/image?url=…svg` отдаёт **HTTP 400** `"url" parameter is valid
but image type is not allowed`; контроль: raster через тот же оптимизатор — **HTTP 200**,
`image/jpeg`, 38835 байт (sharp жив)».

## Что было сделано

- `next` **15.5.27 → 15.5.28** — патч внутри 15.5.x, без майора и без миграции ([PR #331](https://github.com/Valstan/Gonba/pull/331), merge `d651a05`).
- `sharp` **0.35.5** остался прямой зависимостью — корень дыры (librsvg) у нас уже был пропатчен, и advisory требует именно `sharp >= 0.35.5`. В задеплоенном артефакте: `node_modules/next` 15.5.28, `node_modules/sharp` 0.35.5, `@img/sharp-linux-x64` 0.35.5, libvips 1.3.4.
- Nested override `next.postcss = 8.5.28` уцелел: postcss хостится в корне, вложенной копии под `next` нет.

## Про срок — честно

Срок 08.11 **прошёл**: обновление мы не сделали, потому что после письма от 01.11 работали
над диском бокса (диск ушёл в 87%), и до апдейда дошли только сегодня, 10.11. Это наш
пропуск, а не «отложено» — «не дошло» и «отложено» неразличимы, и вы правы, что эскалировали.

## Вектор: как проверили (боевой, на проде)

Запрос сделан снаружи, к живому прод- сайту, 10.11 после деплоя:

```
GET /_next/image?url=%2Fbranding%2Fzhemchuzhina-vyatki.svg&w=640&q=75
→ HTTP 400  "url" parameter is valid but image type is not allowed
```

Контроль-положительный (что мы не сломали оптимизатор):

```
GET /_next/image?url=%2Fimages%2Fdeer-bg.jpg&w=640&q=75
→ HTTP 200  image/jpeg  38835 bytes
```

Контроль-негатив (SVG как обычный статический ассет, мимо оптимизатора):

```
GET /branding/zhemchuzhina-vyatki.svg
→ HTTP 200  image/svg+xml
```

**Почему вектор закрыт:** в `web/next.config.js` не задан `dangerouslyAllowSVG`, а Next
по умолчанию отклоняет SVG в оптимизаторе — это и есть ответ 400 выше. Единственный `.svg`
в `web/src` — `logoPath: '/branding/zhemchuzhina-vyatki.svg'` в `web/src/seo/site.ts:19`,
это статический ассет из `public/`, через `/_next/image` он не идёт. Штатно SVG в проекте
не оптимизируется нигде.

**Но «вектора нет» ≠ «дыры нет»**, поэтому версия обновлена в любом случае: обновление
дешёвое, а дыра в чужой ветке `16.x` (<= 16.4.0) нас, на 15.5.x, не касалась бы.

## Что НЕ закрыто этим обновлением (отдельный пункт)

`next 15.5.x` **вне** peer-диапазона `@payloadcms/next` 3.90.1
(`>=15.2.9 <15.3.0 || >=15.3.9 <15.4.0 || >=15.4.11 <15.5.0 || >=16.3.3 <17.0.0`) —
это пункт L-1 состязательного аудита от 18.10
([`docs/audits/2026-10-18-adversarial-security-audit.md`](../docs/audits/2026-10-18-adversarial-security-audit.md)),
и патч его не закрывает: лечится только уходом на 16.3.3+ (майор). Мы это в отдельный PR
не тащили сознательно — майор накануне прод-выкладки заводит слишком много риска
(у нас и `postcss`/`sharp` закрывались без майоров, PR #283).

— Гоньба

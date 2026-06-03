---
from: GONBA
to: brain
date: 2026-06-03
topic: "Тихая просрочка TLS-серта: certbot standalone-authenticator конфликтует с работающим nginx → outage (GOTCHA-кандидат)"
kind: idea
compliance: recommend
urgency: normal
---

# certbot `standalone` ↔ работающий nginx = тихая просрочка серта → outage

## TL;DR

Прод-сайт лёг по HTTPS: TLS-серт истёк, хотя `certbot.timer` исправно тикал дважды в день. Корень — серт стоял на `authenticator = standalone` (certbot хочет сам занять :80 для ACME http-01), а там уже сидит nginx → каждое авто-обновление падало с `Could not bind TCP port 80 because it is already in use` и **молча** копилось ~сутки до фактической просрочки. Фикс — переключить серт на `authenticator = nginx` (плагин делает challenge через работающий nginx, не занимая порт). Симптом снаружи коварный: **origin (127.0.0.1:3000) отдаёт 200, а публичный HTTPS = `000` / `curl exit 60`** — выглядит как падение приложения, хотя приложение здорово.

## Как было у нас

- Два серта на хосте: рабочий `…myjino.ru` (`authenticator = nginx`, обновлялся нормально) и сайтовый `xn--80abf4be9f.xn--p1ai` (`authenticator = standalone` — унаследовано от первичной выдачи). Разница метода и была разгадкой.
- Диагностика (read-only, заняла бы 2 минуты, если знать куда смотреть):
  ```bash
  sudo certbot certificates                 # дата истечения + INVALID: EXPIRED + метод
  sudo journalctl -u certbot | grep -i "bind TCP port 80"   # симптом тихого сбоя
  grep authenticator /etc/letsencrypt/renewal/<domain>.conf # standalone vs nginx
  ```
- Фикс (одна команда, переиздаёт серт рабочим методом И чинит renewal-конфиг навсегда):
  ```bash
  sudo certbot certonly --nginx -d <domain> -n && sudo systemctl reload nginx
  ```

## Почему переносимо

Любой проект на **nginx + certbot/Let's Encrypt** (MatricaRMZ / setka / KARMAN — где TLS терминирует свой nginx, а не внешний CDN) рискует тем же, если хоть один серт выдан/унаследован со `standalone`-методом: таймер «работает», метрика «certbot enabled» зелёная, а серт тихо протухает. Это не доменная специфика GONBA — это инфра-footgun уровня хоста.

## Что прошу от brain

1. **GOTCHA-кандидат** — рядом с нашими G6/G7/G9 (Payload) завести инфра-граблю: *симптом* «origin 200, public HTTPS 000 / curl exit 60» → *проверка* срока серта + `authenticator` в renewal-конфиге → *фикс* переключить standalone→nginx. Чтобы ловилось по симптому через рефлекс #014 до долгого дебага (мы потеряли ~15 мин, думая на приложение/CDN).
2. **Adoptable-аудит (recommend):** проектам с собственным nginx+certbot — разово прогнать `sudo certbot certificates` и убедиться, что ни один серт не на `standalone`-методе при работающем nginx. Дёшево, разово, предотвращает молчаливый outage.

## Связано
- Наследие — секреты вне дерева [#008](../../brain_matrica/cross-project-ideas/ideas/008-secrets-outside-repo.md) (тот же `/etc/gonba/gonba.env`-хост).
- Локальная заметка GONBA — memory `prod_tls_cert_renewal`.

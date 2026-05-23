// Direction A — «Журнал»
// Тёплый кремовый фон, редакционная антиква PT Serif, акцент — терракота.
// Full-bleed фото, спокойный воздух, минимум хрома.

const journal = {
  bg: '#f5efe4',
  ink: '#1c1814',
  muted: '#6b6258',
  rule: '#d9cfba',
  paper: '#fbf7ee',
  accent: '#b8543a',
  accentDeep: '#8a3a26',
};

const jStyles = {
  page: {
    background: journal.bg,
    color: journal.ink,
    fontFamily: '"Manrope", system-ui, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    width: '100%',
    minHeight: '100%',
  },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 20px 12px', borderBottom: `1px solid ${journal.rule}`,
  },
  wordmark: {
    fontFamily: '"PT Serif", serif', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em',
    display: 'flex', alignItems: 'baseline', gap: 6,
  },
  burger: {
    width: 36, height: 36, border: `1px solid ${journal.ink}`, borderRadius: 0,
    background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: journal.muted,
  },
  heroTitle: {
    fontFamily: '"PT Serif", serif', fontWeight: 700,
    fontSize: 44, lineHeight: 1.02, letterSpacing: '-0.015em',
    margin: '12px 0 18px',
  },
  sectionRule: { height: 1, background: journal.rule, margin: '32px 0' },
  smallCaps: {
    fontFamily: '"PT Serif", serif', fontStyle: 'italic',
    fontSize: 13, color: journal.accent,
  },
};

// Кэп-номер (рубрика)
const Rubric = ({ n, label, color = journal.muted }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
    <span>{n}</span>
    <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.35 }} />
    <span>{label}</span>
  </div>
);

const JournalHome = () => (
  <div className="frame" style={jStyles.page}>
    <StatusBar />
    {/* Wordmark / nav */}
    <div style={jStyles.nav}>
      <div style={jStyles.wordmark}>
        Гоньба<span style={{ color: journal.accent, fontFamily: '"PT Serif", serif', fontStyle: 'italic', fontSize: 14, fontWeight: 400 }}>жемчужина Вятки</span>
      </div>
      <button style={jStyles.burger} aria-label="Меню">
        <svg width="14" height="10" viewBox="0 0 14 10"><path d="M0 1h14M0 5h14M0 9h14" stroke={journal.ink} strokeWidth="1.2" /></svg>
      </button>
    </div>

    {/* Hero photo */}
    <div style={{ position: 'relative' }}>
      <Photo h={460} label="ХРАМ НАД ВЯТКОЙ · РАССВЕТ" tone="rgba(120,90,60,.18)" />
      <div style={{
        position: 'absolute', left: 20, right: 20, bottom: 20,
        color: '#fff', textShadow: '0 1px 18px rgba(0,0,0,.45)',
      }}>
        <div style={{ ...jStyles.eyebrow, color: 'rgba(255,255,255,.85)' }}>Малмыжский район · Кировская область</div>
        <h1 style={{ ...jStyles.heroTitle, color: '#fff', fontSize: 38, margin: '8px 0 0' }}>
          Село на правом<br/>берегу Вятки.
        </h1>
      </div>
    </div>

    {/* Intro */}
    <div style={{ padding: '28px 22px 0' }}>
      <p style={{ fontFamily: '"PT Serif", serif', fontSize: 19, lineHeight: 1.4, color: journal.ink }}>
        Десять проектов в одном селе: храм, эко-отель, ремесленные мастерские,
        конный клуб, экскурсии по району и&nbsp;Гульфия Харисовна — садовая фея.
      </p>
      <p style={{ marginTop: 14, color: journal.muted, fontSize: 14 }}>
        Жемчужина Вятки — не туркомплекс. Это место, которое восстанавливают сами жители.
      </p>
    </div>

    {/* Group: ПОЖИТЬ */}
    <div style={{ padding: '36px 22px 0' }}>
      <Rubric n="01" label="Пожить" />
      <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
        <article style={{ background: journal.paper, padding: 14 }}>
          <Photo h={170} label="ЭКО-ОТЕЛЬ · ВИД С ВЕРАНДЫ" tone="rgba(80,100,70,.18)" />
          <h3 style={{ fontFamily: '"PT Serif", serif', fontSize: 22, margin: '14px 0 6px', lineHeight: 1.15 }}>ЭКО-отель</h3>
          <p style={{ fontSize: 13.5, color: journal.muted, lineHeight: 1.5 }}>
            Шесть номеров с видом на реку. Бронь напрямую, без агрегаторов.
          </p>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={jStyles.smallCaps}>от 4 200 ₽ · ночь</span>
            <Arrow size={16} color={journal.accent} />
          </div>
        </article>
      </div>
    </div>

    {/* Group: ПОПРОБОВАТЬ */}
    <div style={{ padding: '36px 22px 0' }}>
      <Rubric n="02" label="Попробовать" />
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          ['Ремесленные мастерские', 'Гончарка, ткачество, валяние'],
          ['Конный клуб', 'Прогулки и катания, г. Малмыж'],
          ['Вятский сбор', 'Травы, иван-чай, мёд'],
          ['Садовая фея', 'У Гульфии Харисовны'],
        ].map(([t, sub], i) => (
          <article key={i} style={{ background: journal.paper, padding: 12 }}>
            <Photo h={92} tone="rgba(120,80,40,.12)" />
            <div style={{ fontFamily: '"PT Serif", serif', fontSize: 15, fontWeight: 700, marginTop: 10, lineHeight: 1.2 }}>{t}</div>
            <div style={{ fontSize: 11.5, color: journal.muted, marginTop: 4 }}>{sub}</div>
          </article>
        ))}
      </div>
    </div>

    {/* Group: ПОСМОТРЕТЬ */}
    <div style={{ padding: '36px 22px 0' }}>
      <Rubric n="03" label="Посмотреть" />
      <div style={{ marginTop: 14 }}>
        <Photo h={200} label="ХРАМ · ИНТЕРЬЕР" tone="rgba(140,110,70,.18)" />
        <h3 style={{ fontFamily: '"PT Serif", serif', fontSize: 22, margin: '14px 0 6px', lineHeight: 1.15 }}>Село и храм</h3>
        <p style={{ fontSize: 13.5, color: journal.muted, lineHeight: 1.5 }}>
          Покровская церковь, паромная переправа, дома купеческой Гоньбы конца XIX&nbsp;века.
        </p>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0, borderTop: `1px solid ${journal.rule}` }}>
          {[
            ['Экскурсии по району', 'Малмыж · Гоньба · Вятка'],
            ['Вятская лепота', 'Студия. Малмыж'],
          ].map(([t, sub], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${journal.rule}` }}>
              <div>
                <div style={{ fontFamily: '"PT Serif", serif', fontSize: 16, fontWeight: 700 }}>{t}</div>
                <div style={{ fontSize: 12, color: journal.muted, marginTop: 2 }}>{sub}</div>
              </div>
              <Arrow color={journal.muted} />
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Events */}
    <div style={{ padding: '40px 22px 0' }}>
      <Rubric n="04" label="События села" />
      <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
        {[
          { d: '14', m: 'июн', t: 'Покровская ярмарка', sub: 'Ремёсла, угощения, концерт на берегу' },
          { d: '02', m: 'авг', t: 'Спас на Вятке', sub: 'Богослужение, освящение мёда, чаепитие' },
          { d: '21', m: 'сен', t: 'Сбор трав с Гульфией', sub: 'Полевая лаборатория, обед' },
        ].map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 14, borderBottom: `1px solid ${journal.rule}` }}>
            <div style={{ width: 56, flexShrink: 0, textAlign: 'center', borderRight: `1px solid ${journal.rule}`, paddingRight: 14 }}>
              <div style={{ fontFamily: '"PT Serif", serif', fontSize: 30, lineHeight: 1, fontWeight: 700 }}>{e.d}</div>
              <div style={{ fontSize: 10, color: journal.muted, marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{e.m}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: '"PT Serif", serif', fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>{e.t}</div>
              <div style={{ fontSize: 12.5, color: journal.muted, marginTop: 4, lineHeight: 1.5 }}>{e.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Quote */}
    <div style={{ padding: '50px 24px', textAlign: 'center', marginTop: 20, background: journal.paper }}>
      <div style={{ fontFamily: '"PT Serif", serif', fontStyle: 'italic', fontSize: 19, lineHeight: 1.45, color: journal.ink }}>
        «Река Вятка, лес по обе стороны… ширина с&nbsp;Неву, сажен&nbsp;80 или 100.»
      </div>
      <div style={{ marginTop: 14, fontSize: 11, color: journal.muted, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        А. Н. Радищев · 1790
      </div>
    </div>

    {/* Footer CTA */}
    <div style={{ padding: '36px 22px 28px', background: journal.ink, color: '#f5efe4' }}>
      <div style={{ fontFamily: '"PT Serif", serif', fontSize: 26, lineHeight: 1.15, marginBottom: 18 }}>
        Приезжайте на выходные. <br/>
        <span style={{ color: journal.accent, fontStyle: 'italic' }}>Мы покажем село.</span>
      </div>
      <button style={{
        width: '100%', padding: '16px', background: journal.accent, color: '#fff',
        border: 0, fontFamily: '"PT Sans", sans-serif', fontWeight: 700, fontSize: 14,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>Забронировать визит →</button>
      <div style={{ marginTop: 28, fontSize: 12, color: 'rgba(245,239,228,.55)', lineHeight: 1.6 }}>
        Малмыжский район, Кировская область<br/>
        +7 (8332) 00-00-00 · hello@гоньба.рф
      </div>
    </div>

    <HomeIndicator />
  </div>
);

// Supporting screen: Эко-отель — карточка с бронью
const JournalHotel = () => (
  <div className="frame" style={jStyles.page}>
    <StatusBar />
    {/* Back nav */}
    <div style={{ ...jStyles.nav, justifyContent: 'flex-start', gap: 14 }}>
      <button style={{ ...jStyles.burger, width: 36 }} aria-label="Назад">
        <Arrow dir="left" color={journal.ink} />
      </button>
      <div style={{ flex: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: journal.muted }}>
        Пожить · Эко-отель
      </div>
    </div>

    {/* Hero */}
    <Photo h={300} label="ВЕРАНДА · ЗАКАТ НА ВЯТКЕ" tone="rgba(90,110,80,.18)" />

    {/* Title block */}
    <div style={{ padding: '28px 22px 0' }}>
      <div style={jStyles.eyebrow}>Гоньба · правый берег</div>
      <h1 style={{ ...jStyles.heroTitle, fontSize: 36, marginBottom: 14 }}>
        ЭКО-отель<br/>
        <span style={{ fontStyle: 'italic', color: journal.accent, fontWeight: 400 }}>над рекой</span>
      </h1>
      <p style={{ fontFamily: '"PT Serif", serif', fontSize: 17, lineHeight: 1.4 }}>
        Шесть номеров. Деревянная веранда. Завтрак из соседнего огорода Гульфии Харисовны
        и парное молоко с фермы.
      </p>
    </div>

    {/* Facts strip */}
    <div style={{ margin: '28px 22px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: `1px solid ${journal.rule}`, borderBottom: `1px solid ${journal.rule}` }}>
      {[['6', 'номеров'], ['2/4', 'мест'], ['×', 'без TV']].map(([v, l], i) => (
        <div key={i} style={{ padding: '16px 0', textAlign: 'center', borderLeft: i ? `1px solid ${journal.rule}` : 'none' }}>
          <div style={{ fontFamily: '"PT Serif", serif', fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{v}</div>
          <div style={{ fontSize: 10.5, color: journal.muted, marginTop: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{l}</div>
        </div>
      ))}
    </div>

    {/* Gallery row */}
    <div style={{ padding: '28px 22px 0' }}>
      <Rubric n="—" label="Внутри" />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginTop: 12 }}>
        <Photo h={180} label="НОМЕР · ОКНО" tone="rgba(120,90,60,.14)" />
        <div style={{ display: 'grid', gap: 10 }}>
          <Photo h={85} label="БАНЯ" tone="rgba(80,80,60,.14)" />
          <Photo h={85} label="КУХНЯ" tone="rgba(100,80,50,.14)" />
        </div>
      </div>
    </div>

    {/* Booking form */}
    <div style={{ margin: '36px 22px 0', padding: 18, background: journal.paper, border: `1px solid ${journal.rule}` }}>
      <div style={{ fontFamily: '"PT Serif", serif', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Бронирование</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[['Заезд', '14 июн'], ['Выезд', '16 июн']].map(([l, v], i) => (
          <div key={i} style={{ border: `1px solid ${journal.rule}`, padding: '10px 12px', background: '#fff' }}>
            <div style={{ fontSize: 10, color: journal.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontFamily: '"PT Serif", serif', fontSize: 17, fontWeight: 700, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, border: `1px solid ${journal.rule}`, padding: '10px 12px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: journal.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Гости</div>
          <div style={{ fontFamily: '"PT Serif", serif', fontSize: 17, fontWeight: 700, marginTop: 2 }}>2 взрослых</div>
        </div>
        <Arrow color={journal.muted} dir="down" />
      </div>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${journal.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 12, color: journal.muted }}>Итого за 2 ночи</div>
        <div style={{ fontFamily: '"PT Serif", serif', fontSize: 24, fontWeight: 700 }}>8 400 ₽</div>
      </div>
      <button style={{
        width: '100%', marginTop: 14, padding: '16px', background: journal.accent, color: '#fff',
        border: 0, fontFamily: '"PT Sans", sans-serif', fontWeight: 700, fontSize: 14,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>Забронировать</button>
      <div style={{ marginTop: 10, fontSize: 11, color: journal.muted, textAlign: 'center' }}>
        Подтверждение по WhatsApp в течение часа
      </div>
    </div>

    {/* Story strip */}
    <div style={{ padding: '40px 22px 0' }}>
      <Rubric n="—" label="Это место" />
      <p style={{ marginTop: 12, fontFamily: '"PT Serif", serif', fontSize: 16, lineHeight: 1.55 }}>
        Дом построен из лиственницы, привезённой с правого берега. Окна выходят
        на старую паромную переправу — ту самую, что упоминал Радищев в записках
        о путешествии в Сибирь.
      </p>
    </div>

    {/* Related */}
    <div style={{ padding: '36px 22px 28px' }}>
      <Rubric n="—" label="Совместите с" />
      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        {['Прогулка верхом в Малмыже', 'Гончарная мастерская', 'Сбор трав с Гульфией'].map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${journal.rule}` }}>
            <div style={{ fontFamily: '"PT Serif", serif', fontSize: 15, fontWeight: 700 }}>{t}</div>
            <Arrow color={journal.muted} />
          </div>
        ))}
      </div>
    </div>

    <HomeIndicator />
  </div>
);

Object.assign(window, { JournalHome, JournalHotel });

// Direction C — «Скролл-сторителлинг»
// Тёмная кинематографическая сцена, нарратив сверху вниз:
// въезд в село → храм → люди → ремёсла → отель → CTA.

const story = {
  night: '#14130f',
  ink: '#f3ead4',
  muted: 'rgba(243,234,212,.6)',
  ember: '#d97c3a',
  ash: '#3a3830',
  ruleAlpha: 'rgba(243,234,212,.18)',
};

const sStyles = {
  page: {
    background: story.night,
    color: story.ink,
    fontFamily: '"Manrope", system-ui, sans-serif',
    fontSize: 14,
    lineHeight: 1.55,
    width: '100%', minHeight: '100%',
  },
  topBar: {
    position: 'absolute', top: 44, left: 0, right: 0, zIndex: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px',
  },
  word: {
    fontFamily: '"Cormorant Garamond", serif', fontWeight: 500, fontSize: 18,
    letterSpacing: '0.02em', color: story.ink,
    display: 'flex', alignItems: 'baseline', gap: 8,
  },
  burger: {
    width: 36, height: 36, border: `1px solid rgba(243,234,212,.4)`,
    background: 'rgba(20,19,15,.4)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: story.ink,
  },
  eyebrow: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
    color: story.ember,
  },
  bigTitle: {
    fontFamily: '"Cormorant Garamond", serif', fontWeight: 400,
    lineHeight: 0.96, letterSpacing: '-0.01em',
  },
};

// Маркер главы (вертикальная линия + номер)
const ChapterMark = ({ n, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: 22, color: story.ember }}>{n}</div>
    <div style={{ flex: 1, height: 1, background: story.ruleAlpha }} />
    <div style={{ ...sStyles.eyebrow, color: story.muted }}>{label}</div>
  </div>
);

// Полноэкранная сцена с фото-фоном и текстовым слоем
const Scene = ({ photo, tone, n, eyebrow, title, body, height = 720, align = 'bottom' }) => (
  <section style={{
    position: 'relative', height,
    display: 'flex', alignItems: align === 'bottom' ? 'flex-end' : 'center',
  }}>
    <Photo h={height} label={photo} tone={tone} dark style={{ position: 'absolute', inset: 0 }} />
    {/* gradient overlay */}
    <div style={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(180deg, rgba(20,19,15,${align === 'bottom' ? 0.1 : 0.4}) 0%, rgba(20,19,15,${align === 'bottom' ? 0.85 : 0.7}) 100%)`,
    }} />
    <div style={{ position: 'relative', padding: '0 22px 36px', width: '100%' }}>
      {n && <div style={{
        fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic',
        fontSize: 100, lineHeight: 1, color: story.ember, opacity: 0.45,
        marginBottom: -14,
      }}>{n}</div>}
      {eyebrow && <div style={sStyles.eyebrow}>{eyebrow}</div>}
      <h2 style={{ ...sStyles.bigTitle, fontSize: 44, margin: '10px 0 12px' }}>
        {title}
      </h2>
      {body && <p style={{ fontSize: 14.5, lineHeight: 1.6, color: story.muted, maxWidth: 320 }}>
        {body}
      </p>}
    </div>
  </section>
);

const StoryHome = () => (
  <div className="frame" style={sStyles.page}>
    {/* Status overlay on hero */}
    <StatusBar dark />
    <div style={sStyles.topBar}>
      <div style={sStyles.word}>
        ГОНЬБА
        <span style={{ fontStyle: 'italic', fontSize: 12, color: story.ember, letterSpacing: '0.04em' }}>est. 1689</span>
      </div>
      <button style={sStyles.burger}>
        <svg width="14" height="10" viewBox="0 0 14 10"><path d="M0 1h14M0 5h14M0 9h14" stroke="currentColor" strokeWidth="1.2" /></svg>
      </button>
    </div>

    {/* Hero — full screen */}
    <section style={{ position: 'relative', height: 780, display: 'flex', alignItems: 'flex-end' }}>
      <Photo h={780} label="ВЯТКА · ТУМАН · ПРАВЫЙ БЕРЕГ" tone="rgba(40,50,40,.35)" dark style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,19,15,.55) 0%, rgba(20,19,15,.15) 30%, rgba(20,19,15,.95) 100%)' }} />
      <div style={{ position: 'relative', padding: '0 22px 60px', width: '100%' }}>
        <div style={sStyles.eyebrow}>· десять историй одного села ·</div>
        <h1 style={{ ...sStyles.bigTitle, fontSize: 70, margin: '14px 0 18px' }}>
          На правом<br/>
          <span style={{ fontStyle: 'italic', color: story.ember }}>берегу</span><br/>
          Вятки.
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: story.muted, maxWidth: 320 }}>
          Гоньба — село, которое не консервируют, а&nbsp;продолжают жить. Прокрутите —
          мы покажем десять проектов, ради которых сюда стоит приехать.
        </p>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: story.muted }}>
          <div style={{ width: 1, height: 28, background: story.ruleAlpha }} />
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, letterSpacing: '0.2em' }}>↓ SCROLL</div>
        </div>
      </div>
    </section>

    {/* Chapter I — село */}
    <div style={{ padding: '60px 22px 24px' }}>
      <ChapterMark n="I" label="село" />
      <div style={{ marginTop: 28 }}>
        <h2 style={{ ...sStyles.bigTitle, fontSize: 40 }}>
          <span style={{ fontStyle: 'italic', color: story.ember }}>Хлебная</span> пристань<br/>
          купеческой Вятки.
        </h2>
        <p style={{ marginTop: 16, color: story.muted, fontSize: 14.5, lineHeight: 1.65 }}>
          В 1870 году Гоньба известна не только своей пристанью, но и двумя
          заводами&nbsp;— кожевенным и&nbsp;смольным. Сегодня от той эпохи остались
          купеческие дома, паромная переправа и&nbsp;Покровский храм.
        </p>
      </div>
    </div>

    <Scene
      photo="ХРАМ В РАССВЕТНОМ ТУМАНЕ"
      tone="rgba(140,80,40,.3)"
      n="01"
      eyebrow="ПОКРОВСКАЯ ЦЕРКОВЬ · 1808"
      title={<>Стоит<br/><i style={{ color: story.ember }}>над водой</i></>}
      body="Восстанавливают силами села с 2018 года. Литургии — по воскресеньям, экскурсии — по запросу."
      height={760}
    />

    {/* Chapter II — люди */}
    <div style={{ padding: '60px 22px 24px' }}>
      <ChapterMark n="II" label="люди" />
      <div style={{ marginTop: 28 }}>
        <h2 style={{ ...sStyles.bigTitle, fontSize: 38 }}>
          Те, кто <span style={{ fontStyle: 'italic', color: story.ember }}>держит</span> село
        </h2>
      </div>
    </div>

    {/* People — vertical photo cards */}
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[
        { ph: 'ГУЛЬФИЯ В САДУ', t: 'Гульфия Харисовна', role: 'Садовая фея', q: '«Сначала земля, потом всё остальное.»' },
        { ph: 'СТУДИЯ · РУКИ В ГЛИНЕ', t: 'Вятская лепота', role: 'Малмыж · керамика', q: '«Глина с правого берега тяжелее.»' },
        { ph: 'КОНЮХ · ЛУГ', t: 'Конный клуб', role: 'Малмыж', q: '«Лошадь чувствует Вятку раньше нас.»' },
      ].map((p, i) => (
        <article key={i} style={{ position: 'relative', height: 440 }}>
          <Photo h={440} label={p.ph} tone="rgba(80,60,40,.3)" dark style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,19,15,.15) 30%, rgba(20,19,15,.92) 100%)' }} />
          <div style={{ position: 'absolute', left: 22, right: 22, bottom: 28 }}>
            <div style={sStyles.eyebrow}>{p.role}</div>
            <div style={{ ...sStyles.bigTitle, fontSize: 30, margin: '8px 0 12px' }}>{p.t}</div>
            <div style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: 17, color: story.muted, lineHeight: 1.4 }}>
              {p.q}
            </div>
          </div>
        </article>
      ))}
    </div>

    {/* Chapter III — ремёсла */}
    <div style={{ padding: '60px 22px 24px' }}>
      <ChapterMark n="III" label="что делать" />
      <div style={{ marginTop: 28 }}>
        <h2 style={{ ...sStyles.bigTitle, fontSize: 40 }}>
          Руками,<br/><i style={{ color: story.ember }}>а не глазами.</i>
        </h2>
        <p style={{ marginTop: 14, color: story.muted, fontSize: 14.5, lineHeight: 1.65 }}>
          Четыре мастерские, в которые можно записаться на выходные.
          Каждая длится 2–4&nbsp;часа, инструменты у&nbsp;нас, итог увезёте с&nbsp;собой.
        </p>
      </div>

      <div style={{ marginTop: 24, display: 'grid', gap: 1, background: story.ruleAlpha }}>
        {[
          ['Гончарка', '2 ч · 1 800 ₽'],
          ['Ткачество', '3 ч · 2 200 ₽'],
          ['Валяние', '2 ч · 1 600 ₽'],
          ['Лозоплетение', '4 ч · 2 800 ₽'],
        ].map(([t, d], i) => (
          <div key={i} style={{ background: story.night, padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
              <div style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: 14, color: story.ember, width: 18 }}>{String(i+1).padStart(2,'0')}</div>
              <div style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 24, lineHeight: 1 }}>{t}</div>
            </div>
            <div style={{ fontSize: 11.5, color: story.muted, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>{d}</div>
          </div>
        ))}
      </div>
    </div>

    <Scene
      photo="ЭКО-ОТЕЛЬ · ВЕЧЕРНИЕ ОКНА"
      tone="rgba(60,80,90,.3)"
      n="02"
      eyebrow="ГДЕ ОСТАНОВИТЬСЯ"
      title={<>Эко-отель.<br/><i style={{ color: story.ember }}>Шесть номеров.</i></>}
      body="С верандой над рекой и завтраком из соседнего огорода. От 4 200 ₽ за ночь."
      height={760}
    />

    {/* Pull quote */}
    <div style={{ padding: '80px 28px', textAlign: 'center' }}>
      <div style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: 28, lineHeight: 1.3 }}>
        «Река Вятка, лес по обе стороны…<br/>
        ширина <span style={{ color: story.ember }}>с&nbsp;Неву</span>,<br/>
        сажен 80 или 100.»
      </div>
      <div style={{ marginTop: 22, fontSize: 10, color: story.muted, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.2em' }}>
        — А. Н. РАДИЩЕВ · 1790
      </div>
    </div>

    {/* Events strip */}
    <div style={{ padding: '20px 22px 0' }}>
      <ChapterMark n="IV" label="что будет летом" />
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {[
          ['14 ИЮН', 'Покровская ярмарка'],
          ['02 АВГ', 'Спас на Вятке'],
          ['21 СЕН', 'Сбор трав с Гульфией'],
        ].map(([d, t], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 0', borderBottom: `1px solid ${story.ruleAlpha}` }}>
            <div style={{ width: 64, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: story.ember, letterSpacing: '0.08em' }}>{d}</div>
            <div style={{ flex: 1, fontFamily: '"Cormorant Garamond", serif', fontSize: 22, lineHeight: 1.15 }}>{t}</div>
            <Arrow color={story.muted} />
          </div>
        ))}
      </div>
    </div>

    {/* CTA */}
    <div style={{ padding: '80px 22px 60px', textAlign: 'center' }}>
      <ChapterMark n="V" label="едем" />
      <h2 style={{ ...sStyles.bigTitle, fontSize: 52, margin: '28px 0 18px' }}>
        Приезжайте<br/>
        <i style={{ color: story.ember }}>на выходные.</i>
      </h2>
      <p style={{ color: story.muted, fontSize: 14, maxWidth: 280, margin: '0 auto 28px', lineHeight: 1.6 }}>
        Соберём для вас маршрут: где остановиться, что попробовать, кого встретить.
      </p>
      <button style={{
        padding: '18px 28px', background: story.ember, color: story.night,
        border: 0, fontFamily: '"PT Sans", sans-serif', fontWeight: 700, fontSize: 13,
        letterSpacing: '0.14em', textTransform: 'uppercase',
      }}>Спланировать поездку</button>
      <div style={{ marginTop: 18, fontSize: 11, color: story.muted, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em' }}>
        +7 (8332) 00-00-00 · @гоньба
      </div>
    </div>

    {/* Footer */}
    <div style={{ padding: '40px 22px 28px', borderTop: `1px solid ${story.ruleAlpha}`, color: story.muted }}>
      <div style={{ ...sStyles.bigTitle, fontSize: 22, color: story.ink }}>Гоньба</div>
      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
        Малмыжский район, Кировская область<br/>
        Жемчужина Вятки · экосистема проектов
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 18, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        <span>WhatsApp</span>
        <span>Telegram</span>
        <span>VK</span>
      </div>
    </div>

    <HomeIndicator dark />
  </div>
);

window.StoryHome = StoryHome;

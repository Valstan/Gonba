// Direction B — «Этно-модерн»
// Землистая палитра, вятский ромб как тонкий акцент.
// Хвойный зелёный + охра + кремовая бумага.

const ethno = {
  paper: '#ede3cf',
  paperDeep: '#e2d6b8',
  ink: '#1f2418',
  forest: '#2d4029',
  ochre: '#a86a1d',
  oxblood: '#6e2018',
  muted: '#6b6450',
  rule: '#c9bd9d',
};

const eStyles = {
  page: {
    background: ethno.paper,
    color: ethno.ink,
    fontFamily: '"Manrope", system-ui, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    width: '100%', minHeight: '100%',
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 18px 12px', background: ethno.forest, color: ethno.paper,
  },
  word: {
    fontFamily: '"PT Serif", serif', fontWeight: 700, fontSize: 17,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  eyebrow: {
    fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
    letterSpacing: '0.18em', textTransform: 'uppercase',
  },
};

// Звезда-ромб (логотип-марка)
const RhombMark = ({ size = 14, color = ethno.ochre }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M8 1 L15 8 L8 15 L1 8 Z" stroke={color} strokeWidth="1.4" />
    <path d="M8 5 L11 8 L8 11 L5 8 Z" fill={color} />
  </svg>
);

// Орнаментальная разделительная полоса
const EthnoDivider = ({ color = ethno.ochre, light }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color, padding: '8px 0' }}>
    <div style={{ flex: 1, height: 1, background: 'currentColor', opacity: light ? 0.35 : 0.5 }} />
    <RhombMark size={10} color={color} />
    <div style={{ width: 4, height: 4, background: color, transform: 'rotate(45deg)' }} />
    <RhombMark size={10} color={color} />
    <div style={{ flex: 1, height: 1, background: 'currentColor', opacity: light ? 0.35 : 0.5 }} />
  </div>
);

const EthnoHome = () => (
  <div className="frame" style={eStyles.page}>
    <StatusBar dark />
    <div style={eStyles.topBar}>
      <div style={eStyles.word}>
        <RhombMark size={16} color={ethno.ochre} />
        Гоньба
      </div>
      <div style={{ ...eStyles.eyebrow, color: 'rgba(237,227,207,.7)' }}>МАЛМЫЖСКИЙ Р-Н</div>
      <button style={{ width: 32, height: 32, background: 'transparent', border: 'none', color: ethno.paper }}>
        <svg width="18" height="14" viewBox="0 0 18 14"><path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
    </div>

    {/* Hero with ornament frame */}
    <div style={{ position: 'relative', padding: '20px 18px 0' }}>
      <div style={{ border: `1px solid ${ethno.rule}`, padding: 8, background: ethno.paperDeep }}>
        <Photo h={340} label="ПОКРОВСКАЯ ЦЕРКОВЬ · ИЮЛЬ" tone="rgba(45,64,41,.18)" />
      </div>
      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <div style={{ ...eStyles.eyebrow, color: ethno.ochre }}>· село на правом берегу Вятки ·</div>
        <h1 style={{
          fontFamily: '"PT Serif", serif', fontWeight: 700,
          fontSize: 42, lineHeight: 1.05, margin: '10px 0 0',
          letterSpacing: '-0.01em',
        }}>
          Жемчужина<br/>
          <span style={{ fontStyle: 'italic', color: ethno.forest, fontWeight: 400 }}>Вятки</span>
        </h1>
        <EthnoDivider color={ethno.ochre} />
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: ethno.muted, padding: '0 14px' }}>
          Десять проектов, которые держат село живым: храм, отель, мастерские,
          конный клуб, ремёсла и&nbsp;человеческие истории.
        </p>
      </div>
    </div>

    {/* Tabs nav */}
    <div style={{ margin: '32px 18px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {[
        ['Пожить', ethno.forest],
        ['Делать', ethno.ochre],
        ['Смотреть', ethno.oxblood],
        ['Купить', '#3a5236'],
      ].map(([l, c], i) => (
        <button key={i} style={{
          padding: '12px 4px', background: 'transparent',
          border: `1px solid ${c}`, color: c,
          fontFamily: '"PT Sans", sans-serif', fontWeight: 700, fontSize: 12,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{l}</button>
      ))}
    </div>

    {/* Featured section: храм */}
    <div style={{ padding: '40px 18px 0' }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: ethno.ochre, letterSpacing: '0.2em', textTransform: 'uppercase' }}>I · село и храм</div>
      <h2 style={{ fontFamily: '"PT Serif", serif', fontSize: 28, lineHeight: 1.1, margin: '8px 0 14px', fontWeight: 700 }}>
        Покровская церковь<br/>
        <span style={{ fontStyle: 'italic', color: ethno.muted, fontWeight: 400, fontSize: 22 }}>стоит с 1808 года</span>
      </h2>
      <div style={{ border: `1px solid ${ethno.rule}`, background: ethno.paperDeep, padding: 8 }}>
        <Photo h={210} label="ИНТЕРЬЕР ХРАМА" tone="rgba(110,32,24,.16)" />
      </div>
      <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6, color: ethno.muted }}>
        Каменный пятиглавый храм, заложенный купцом Юшковым. Восстанавливается силами села
        с 2018 года.
      </p>
      <button style={{
        marginTop: 16, padding: '10px 14px', background: 'transparent',
        border: `1.5px solid ${ethno.forest}`, color: ethno.forest,
        fontFamily: '"PT Sans", sans-serif', fontWeight: 700, fontSize: 12,
        letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-flex', gap: 8, alignItems: 'center',
      }}>
        Читать главу <Arrow color={ethno.forest} size={12} />
      </button>
    </div>

    <div style={{ padding: '32px 18px 0' }}>
      <EthnoDivider color={ethno.rule} light />
    </div>

    {/* People */}
    <div style={{ padding: '20px 18px 0' }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: ethno.ochre, letterSpacing: '0.2em', textTransform: 'uppercase' }}>II · люди села</div>
      <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
        {[
          { name: 'Гульфия Харисовна', role: 'Садовая фея', img: 'ПОРТРЕТ · В САДУ', c: ethno.ochre },
          { name: 'Студия «Вятская лепота»', role: 'Малмыж · керамика', img: 'РУКИ · ГЛИНА', c: ethno.oxblood },
          { name: 'Конный клуб', role: 'г. Малмыж', img: 'ВСАДНИК · ЛУГ', c: ethno.forest },
        ].map((p, i) => (
          <article key={i} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ width: 100, flexShrink: 0, border: `1px solid ${ethno.rule}`, padding: 4, background: ethno.paperDeep }}>
              <Photo h={110} label={p.img} tone="rgba(120,90,40,.14)" />
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ ...eStyles.eyebrow, color: p.c }}>{p.role}</div>
              <div style={{ fontFamily: '"PT Serif", serif', fontSize: 18, fontWeight: 700, lineHeight: 1.2, margin: '6px 0 8px' }}>
                {p.name}
              </div>
              <div style={{ fontSize: 12, color: ethno.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                История <Arrow color={ethno.muted} size={12} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>

    {/* Crafts grid */}
    <div style={{ padding: '40px 18px 0' }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: ethno.ochre, letterSpacing: '0.2em', textTransform: 'uppercase' }}>III · ремесленные мастерские</div>
      <h2 style={{ fontFamily: '"PT Serif", serif', fontSize: 26, lineHeight: 1.1, margin: '8px 0 16px', fontWeight: 700 }}>
        Что можно попробовать руками
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { t: 'Гончарка', d: '2 часа · 1 800 ₽' },
          { t: 'Ткачество', d: '3 часа · 2 200 ₽' },
          { t: 'Валяние', d: '2 часа · 1 600 ₽' },
          { t: 'Лозоплетение', d: '4 часа · 2 800 ₽' },
        ].map((c, i) => (
          <div key={i} style={{ background: ethno.paperDeep, border: `1px solid ${ethno.rule}`, padding: 12 }}>
            <Photo h={86} tone="rgba(120,80,40,.18)" />
            <RhombMark size={9} color={ethno.ochre} />
            <div style={{ fontFamily: '"PT Serif", serif', fontWeight: 700, fontSize: 16, marginTop: 6 }}>{c.t}</div>
            <div style={{ fontSize: 11, color: ethno.muted, marginTop: 3 }}>{c.d}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Shop teaser */}
    <div style={{ margin: '40px 18px 0', background: ethno.forest, color: ethno.paper, padding: '22px 18px' }}>
      <div style={{ ...eStyles.eyebrow, color: ethno.ochre }}>IV · Вятский сбор</div>
      <h2 style={{ fontFamily: '"PT Serif", serif', fontSize: 24, lineHeight: 1.15, margin: '8px 0 12px', fontWeight: 700 }}>
        Травы, иван-чай и&nbsp;мёд<br/>
        <span style={{ fontStyle: 'italic', color: ethno.ochre, fontWeight: 400 }}>с малмыжских лугов</span>
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(237,227,207,.78)' }}>
        Собираем сами. Сушим в Гоньбе. Высылаем СДЭКом по&nbsp;всей России.
      </p>
      <button style={{
        marginTop: 14, padding: '12px 16px', background: ethno.ochre, color: ethno.ink,
        border: 0, fontFamily: '"PT Sans", sans-serif', fontWeight: 700, fontSize: 12,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>В магазин →</button>
    </div>

    {/* Events ribbon */}
    <div style={{ padding: '40px 18px 0' }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: ethno.ochre, letterSpacing: '0.2em', textTransform: 'uppercase' }}>V · события села</div>
      <div style={{ marginTop: 14, display: 'grid', gap: 0, borderTop: `2px solid ${ethno.ink}` }}>
        {[
          ['14 ИЮН', 'Покровская ярмарка', 'Ремёсла, угощения, концерт'],
          ['02 АВГ', 'Спас на Вятке', 'Освящение мёда, чаепитие'],
          ['21 СЕН', 'Сбор трав', 'Полевая лаборатория с Гульфией'],
          ['14 ОКТ', 'Покров', 'Литургия, общий стол'],
        ].map(([d, t, sub], i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: `1px solid ${ethno.rule}`, alignItems: 'center' }}>
            <div style={{ width: 60, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: ethno.ochre, letterSpacing: '0.08em' }}>{d}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: '"PT Serif", serif', fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{t}</div>
              <div style={{ fontSize: 12, color: ethno.muted, marginTop: 2 }}>{sub}</div>
            </div>
            <Arrow color={ethno.muted} />
          </div>
        ))}
      </div>
    </div>

    {/* Footer */}
    <div style={{ marginTop: 40, padding: '24px 18px 28px', background: ethno.ink, color: ethno.paper, textAlign: 'center' }}>
      <RhombMark size={18} color={ethno.ochre} />
      <div style={{ fontFamily: '"PT Serif", serif', fontStyle: 'italic', fontSize: 18, marginTop: 10 }}>
        «село на правом берегу Вятки»
      </div>
      <EthnoDivider color={ethno.ochre} light />
      <div style={{ fontSize: 11, color: 'rgba(237,227,207,.6)', lineHeight: 1.7, marginTop: 6, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em' }}>
        ГОНЬБА · МАЛМЫЖСКИЙ Р-Н<br/>+7 (8332) 00-00-00
      </div>
    </div>

    <HomeIndicator dark />
  </div>
);

// Supporting: Ремёсла — мастер-класс детально
const EthnoCraft = () => (
  <div className="frame" style={eStyles.page}>
    <StatusBar />
    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${ethno.rule}`, display: 'flex', gap: 14, alignItems: 'center' }}>
      <button style={{ width: 32, height: 32, background: 'transparent', border: 'none' }}>
        <Arrow dir="left" color={ethno.ink} />
      </button>
      <div style={{ flex: 1, ...eStyles.eyebrow, color: ethno.muted }}>· II / 4 · мастерские ·</div>
    </div>

    <div style={{ padding: '20px 18px 0' }}>
      <div style={{ ...eStyles.eyebrow, color: ethno.ochre, textAlign: 'center' }}>· гончарная мастерская ·</div>
      <h1 style={{ fontFamily: '"PT Serif", serif', fontSize: 36, lineHeight: 1.05, textAlign: 'center', margin: '8px 0 0', fontWeight: 700 }}>
        Глина<br/>
        <span style={{ fontStyle: 'italic', color: ethno.oxblood, fontWeight: 400 }}>с правого берега</span>
      </h1>
      <EthnoDivider color={ethno.ochre} />
    </div>

    <div style={{ padding: '0 18px' }}>
      <div style={{ border: `1px solid ${ethno.rule}`, padding: 8, background: ethno.paperDeep }}>
        <Photo h={360} label="РУКИ МАСТЕРА · ГОНЧАРНЫЙ КРУГ" tone="rgba(110,32,24,.16)" />
      </div>
    </div>

    {/* Master strip */}
    <div style={{ margin: '20px 18px 0', padding: '16px', background: ethno.paperDeep, border: `1px solid ${ethno.rule}`, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${ethno.rule}` }}>
        <Photo h={60} tone="rgba(120,90,60,.18)" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ ...eStyles.eyebrow, color: ethno.oxblood }}>МАСТЕР</div>
        <div style={{ fontFamily: '"PT Serif", serif', fontSize: 18, fontWeight: 700, marginTop: 2 }}>Андрей К.</div>
        <div style={{ fontSize: 12, color: ethno.muted }}>работает с глиной 14 лет</div>
      </div>
    </div>

    {/* Body */}
    <div style={{ padding: '28px 18px 0' }}>
      <p style={{ fontFamily: '"PT Serif", serif', fontSize: 18, lineHeight: 1.45, color: ethno.ink }}>
        За два часа сделаете на круге одну вещь — кружку, тарелку или горшок. Обжигаем
        и&nbsp;высылаем почтой через неделю.
      </p>
    </div>

    {/* Steps */}
    <div style={{ padding: '28px 18px 0' }}>
      <div style={{ ...eStyles.eyebrow, color: ethno.ochre }}>как проходит</div>
      <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
        {[
          ['1', 'Знакомство с глиной', '20 мин — выбор массы, текстуры'],
          ['2', 'Работа на круге', '60 мин — формовка под мастера'],
          ['3', 'Декор и подпись', '30 мин — гравировка, штамп'],
          ['4', 'Обжиг и отправка', 'неделя — почтой по России'],
        ].map(([n, t, sub], i) => (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${ethno.oxblood}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"PT Serif", serif', fontWeight: 700, color: ethno.oxblood,
              flexShrink: 0,
            }}>{n}</div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontFamily: '"PT Serif", serif', fontSize: 16, fontWeight: 700 }}>{t}</div>
              <div style={{ fontSize: 12.5, color: ethno.muted, marginTop: 2 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Price block */}
    <div style={{ margin: '36px 18px 0', padding: '20px', background: ethno.forest, color: ethno.paper }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ ...eStyles.eyebrow, color: ethno.ochre }}>стоимость</div>
          <div style={{ fontFamily: '"PT Serif", serif', fontSize: 32, fontWeight: 700, marginTop: 4 }}>1 800 ₽</div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(237,227,207,.7)', textAlign: 'right' }}>
          ≈ 2 часа<br/>с человека
        </div>
      </div>
      <button style={{
        width: '100%', marginTop: 16, padding: '16px', background: ethno.ochre, color: ethno.ink,
        border: 0, fontFamily: '"PT Sans", sans-serif', fontWeight: 700, fontSize: 14,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>Записаться</button>
      <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(237,227,207,.6)', textAlign: 'center' }}>
        Группы до 6 человек · круглый год
      </div>
    </div>

    {/* Other masters */}
    <div style={{ padding: '36px 18px 28px' }}>
      <EthnoDivider color={ethno.rule} light />
      <div style={{ ...eStyles.eyebrow, color: ethno.muted, textAlign: 'center', marginTop: 10 }}>другие мастерские</div>
      <div style={{ marginTop: 14, display: 'grid', gap: 0 }}>
        {['Ткачество', 'Валяние шерсти', 'Лозоплетение'].map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${ethno.rule}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <RhombMark size={10} color={ethno.ochre} />
              <div style={{ fontFamily: '"PT Serif", serif', fontSize: 16, fontWeight: 700 }}>{t}</div>
            </div>
            <Arrow color={ethno.muted} />
          </div>
        ))}
      </div>
    </div>

    <HomeIndicator />
  </div>
);

Object.assign(window, { EthnoHome, EthnoCraft, RhombMark, EthnoDivider });

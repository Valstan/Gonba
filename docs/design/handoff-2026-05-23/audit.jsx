// Audit panel — visual analysis of current site issues
const auditStyle = {
  wrap: {
    width: 1280, padding: '56px 64px',
    background: '#f6f3ec', color: '#1c1a16',
    fontFamily: '"Manrope", system-ui, sans-serif',
  },
  eyebrow: {
    fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: '#8a7c5e', marginBottom: 18,
  },
  h1: {
    fontFamily: '"PT Serif", serif', fontSize: 42, lineHeight: 1.1, fontWeight: 700,
    marginBottom: 14, maxWidth: 760, letterSpacing: '-0.01em',
  },
  lede: { fontSize: 15, lineHeight: 1.55, color: '#4a4640', maxWidth: 760, marginBottom: 40 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#d9d2c0' },
  card: { background: '#f6f3ec', padding: '24px 22px' },
  cardNum: { fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#8a7c5e', marginBottom: 8 },
  cardH: { fontFamily: '"PT Serif", serif', fontSize: 19, lineHeight: 1.25, marginBottom: 10, fontWeight: 700 },
  cardP: { fontSize: 13.5, lineHeight: 1.55, color: '#534e44' },
  navBad: {
    marginTop: 16,
    padding: '14px 18px', border: '1px solid #d9d2c0',
    background: '#fff', fontSize: 13, lineHeight: 1.7, color: '#534e44',
    fontFamily: '"PT Sans", system-ui, sans-serif',
  },
  slug: { fontFamily: '"JetBrains Mono", monospace', background: '#fff0d8', color: '#8a5a1a', padding: '1px 6px', borderRadius: 2, fontSize: 12 },
};

const AuditCard = ({ n, title, children }) => (
  <div style={auditStyle.card}>
    <div style={auditStyle.cardNum}>0{n}</div>
    <h3 style={auditStyle.cardH}>{title}</h3>
    <p style={auditStyle.cardP}>{children}</p>
  </div>
);

const AuditPanel = () => (
  <div style={auditStyle.wrap}>
    <div style={auditStyle.eyebrow}>Аудит · гоньба.рф</div>
    <h1 style={auditStyle.h1}>Бренд силён — упаковка его глушит.</h1>
    <p style={auditStyle.lede}>
      «Жемчужина Вятки» — экосистема из десяти проектов: село, храм, эко-отель, конный клуб,
      ремёсла, экскурсии, мастера. Это редкая по плотности история — но текущий сайт подаёт
      её как плоский список ссылок. Ниже — что я предлагаю чинить в первую очередь.
    </p>

    <div style={auditStyle.navBad}>
      <strong style={{ fontFamily: '"PT Serif", serif' }}>Текущая навигация (фрагмент из выдачи):</strong><br/>
      Гоньба — жемчужина Вятки · События села · Экскурсии · Мастерские · Вятская лепота ·
      Село и храм · Садовая фея Гульфия Харисовна · Конный клуб г.Малмыж ·
      <span style={auditStyle.slug}>eco-hotel-booking</span>
      {' '}·{' '}
      <span style={auditStyle.slug}>about-project</span>
      {' '}·{' '}
      <span style={auditStyle.slug}>vyatskiy-sbor</span>
      {' '}· Студия «Вятская Лепота»
      <div style={{ marginTop: 8, fontSize: 12, color: '#a85a1a' }}>
        ↑ технические слаги утекли в меню — у трёх пунктов так и не назначены русские заголовки
      </div>
    </div>

    <div style={{ ...auditStyle.grid, marginTop: 32 }}>
      <AuditCard n="1" title="Слаги вместо названий">
        eco-hotel-booking, about-project, vyatskiy-sbor — выведены как пункты меню.
        Это техдолг, который видит каждый посетитель.
      </AuditCard>
      <AuditCard n="2" title="Плоский список 10+ ссылок">
        Нет иерархии: проживание, активности, культура, мастера — всё в одной линейке.
        Пользователь не понимает, где «жить», а где «смотреть».
      </AuditCard>
      <AuditCard n="3" title="Нет позиционирования">
        «Экосистема проектов: ферма, отель, ремёсла» — сильный тезис, но он не работает как
        hero. Главная сразу падает в список разделов.
      </AuditCard>
      <AuditCard n="4" title="Фото — не герой">
        Гоньба — это берег Вятки, паромная переправа, храм над водой. Сайт должен дышать
        этой натурой. Сейчас фотография подчинена тексту, не наоборот.
      </AuditCard>
      <AuditCard n="5" title="Нет «что делать»">
        Турист приходит с вопросом «куда поехать на выходные?». Сайт отвечает структурой,
        а не сценарием: маршрут, время, что взять с собой, где переночевать.
      </AuditCard>
      <AuditCard n="6" title="Мобильный — второй сорт">
        Большинство трафика для туристического региона — мобильный. Дизайн должен начинаться
        с экрана 390px, а не сжиматься в него.
      </AuditCard>
    </div>

    <div style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid #d9d2c0', display: 'flex', gap: 32 }}>
      <div style={{ flex: 1 }}>
        <div style={auditStyle.eyebrow}>Что предлагаю</div>
        <p style={{ ...auditStyle.cardP, fontSize: 14.5 }}>
          Три направления визуального языка, каждое решает аудит по-своему. Все три —
          mobile-first, на тёплой природной палитре, с фото-первой иерархией и
          сгруппированной навигацией: <em>«Пожить · Попробовать · Посмотреть · Купить»</em>.
        </p>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, fontSize: 12.5 }}>
        {[
          ['A', 'Журнал', 'Редакционная вёрстка, фото full-bleed, антиква и спокойный воздух.'],
          ['B', 'Этно-модерн', 'Вятский ромб как акцент, землистая палитра, ощущение промысла.'],
          ['C', 'Сторителлинг', 'Тёмная сцена, скролл-нарратив: вход в село → храм → люди.'],
        ].map(([k, name, desc]) => (
          <div key={k} style={{ border: '1px solid #d9d2c0', padding: '12px 14px', background: '#fff' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#8a7c5e' }}>{k}</div>
            <div style={{ fontFamily: '"PT Serif", serif', fontWeight: 700, margin: '4px 0 6px', fontSize: 15 }}>{name}</div>
            <div style={{ color: '#534e44', lineHeight: 1.45 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

window.AuditPanel = AuditPanel;

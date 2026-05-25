import React from 'react'

interface EthnoQuoteSectionProps {
  text?: string
  author?: string
}

/**
 * Цитата Радищева — финальная секция главной.
 * Centered, paper-deep фон, italic serif blockquote, mono cite.
 *
 * Источник: docs/design/handoff-2026-05-23/gonba-home.html строки 625-647 + 1044-1048.
 */
export const EthnoQuoteSection: React.FC<EthnoQuoteSectionProps> = ({
  text = '«Река Вятка, лес по обе стороны… ширина с Неву, сажен 80 или 100.»',
  author = 'А. Н. Радищев · 1790',
}) => (
  <section className="ethno-quote">
    <div className="container">
      <span
        className="ethno-rhomb"
        style={{ width: 16, height: 16, display: 'inline-block' }}
        aria-hidden="true"
      />
      <blockquote>{text}</blockquote>
      <cite>{author}</cite>
    </div>
  </section>
)

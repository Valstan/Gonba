'use client'

import { useEffect, useMemo, useState } from 'react'

import { LentaCard } from './LentaCard'
import { LentaFlow } from './LentaFlow'
import { LentaLightbox } from './LentaLightbox'
import { LentaUpload } from './LentaUpload'
import type { LentaItem } from './lentaTypes'
import { ugcHeaders, unlikeSubmission } from './ugcClient'

// Открытый в лайтбоксе пост (по id — всегда берём свежий из items) + индекс кадра.
type OpenMedia = { id: number; mediaIndex: number }

type Sort = 'new' | 'likes' | 'views'

// Клиентский контейнер ленты: держит снимок публикаций (initialItems из ISR-сервера)
// + локально добавленные после загрузки; сортировка — в браузере. Так роут остаётся
// статически кэшируемым (без searchParams). Вкладки рейтинга и фотобатл — этап 2.
export function LentaFeed({ initialItems }: { initialItems: LentaItem[] }) {
  const [items, setItems] = useState<LentaItem[]>(initialItems)
  const [sort, setSort] = useState<Sort>('new')
  // Открытый в лайтбоксе пост и активный кадр его галереи (null — закрыт).
  const [open, setOpen] = useState<OpenMedia | null>(null)
  // Режим «Смотреть подряд» (вертикальный свайп-просмотр в стиле клипов).
  const [flowOpen, setFlowOpen] = useState(false)
  // Сигнал «открой форму загрузки» (deep-link /lenta#upload).
  const [uploadSignal, setUploadSignal] = useState(0)

  // Deep-links: #flow → просмотр подряд, #upload → форма загрузки. Хэш (не
  // searchParams) — роут остаётся статически кэшируемым (ISR).
  useEffect(() => {
    const apply = () => {
      if (window.location.hash === '#flow') setFlowOpen(true)
      else if (window.location.hash === '#upload') setUploadSignal((s) => s + 1)
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  // Лайки (id постов) — состояние поднято сюда, чтобы карточка и лайтбокс показывали
  // ОДИН лайк синхронно. Гидрируем из localStorage после монтирования (анти-SSR-расхож.).
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    const s = new Set<number>()
    try {
      for (const it of initialItems) if (localStorage.getItem(`ugc-liked:${it.id}`)) s.add(it.id)
    } catch {
      /* приватный режим — игнор */
    }
    setLikedIds(s)
  }, [initialItems])

  // Лайк/отмена (оптимистично): множество likedIds + счётчик в items; дедуп localStorage
  // + сервер (409 = уже лайкнули с этого IP → оставляем). Любая иная ошибка — откат.
  async function toggleLike(id: number) {
    const wasLiked = likedIds.has(id)
    const applied = (like: boolean) => {
      setLikedIds((prev) => {
        const nset = new Set(prev)
        if (like) nset.add(id)
        else nset.delete(id)
        return nset
      })
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, likeCount: Math.max(0, it.likeCount + (like ? 1 : -1)) } : it)),
      )
      try {
        if (like) localStorage.setItem(`ugc-liked:${id}`, '1')
        else localStorage.removeItem(`ugc-liked:${id}`)
      } catch {
        /* игнор */
      }
    }
    applied(!wasLiked)
    try {
      if (wasLiked) {
        const ok = await unlikeSubmission(id)
        if (!ok) applied(true) // сервер не снял (лайк из другого браузера) — вернуть
      } else {
        const res = await fetch('/api/submission-reactions', {
          method: 'POST',
          headers: ugcHeaders(), // + X-UGC-Owner → лайк привязан к браузеру (для отмены)
          body: JSON.stringify({ submission: id }),
        })
        if (!res.ok && res.status !== 409) applied(false) // откат
      }
    } catch {
      applied(wasLiked) // вернуть как было
    }
  }

  // Убрать пост из ленты (после удаления своего) + закрыть лайтбокс, если он на нём.
  function removeItem(id: number) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    setOpen((o) => (o && o.id === id ? null : o))
  }

  const view = useMemo(() => {
    // items в порядке «Новое» (сервер отдал по -createdAt; новые загрузки prepend'ятся).
    if (sort === 'likes') return [...items].sort((a, b) => b.likeCount - a.likeCount)
    if (sort === 'views') return [...items].sort((a, b) => b.viewCount - a.viewCount)
    return items
  }, [items, sort])

  const sorts: { key: Sort; label: string }[] = [
    { key: 'new', label: 'Новое' },
    { key: 'likes', label: 'По лайкам' },
    { key: 'views', label: 'По просмотрам' },
  ]

  // Открытый пост берём СВЕЖИМ из items по id (likeCount/media актуальны после лайка/удаления).
  const openItem = open ? (items.find((it) => it.id === open.id) ?? null) : null

  return (
    <div className="lenta">
      <div className="lenta-top">
        <LentaUpload openSignal={uploadSignal} onUploaded={(item) => setItems((prev) => [item, ...prev])} />
        {items.length > 0 && (
          <button type="button" className="lenta-flow-open" onClick={() => setFlowOpen(true)}>
            ▶ Смотреть подряд
          </button>
        )}
        {items.length > 0 && (
          <div className="lenta-controls" role="group" aria-label="Сортировка">
            <div className="lenta-filter">
              {sorts.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`lenta-chip${sort === s.key ? ' is-active' : ''}`}
                  aria-pressed={sort === s.key}
                  onClick={() => setSort(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {view.length > 0 ? (
        <ul className="lenta-grid">
          {view.map((item) => (
            <LentaCard
              key={item.id}
              item={item}
              liked={likedIds.has(item.id)}
              onToggleLike={() => toggleLike(item.id)}
              onOpenMedia={(mediaIndex) => setOpen({ id: item.id, mediaIndex })}
              onRemoved={removeItem}
            />
          ))}
        </ul>
      ) : (
        <div className="placeholder">
          Пока пусто. Станьте первым — поделитесь фото или видео из Гоньбы!
        </div>
      )}

      {openItem && open && (
        <LentaLightbox
          submissionId={openItem.id}
          media={openItem.media}
          index={Math.min(open.mediaIndex, openItem.media.length - 1)}
          caption={openItem.caption}
          authorName={openItem.authorName}
          liked={likedIds.has(openItem.id)}
          likeCount={openItem.likeCount}
          onClose={() => setOpen(null)}
          onToggleLike={() => toggleLike(openItem.id)}
          onRemoved={removeItem}
          onNavigate={(i) => setOpen((o) => (o ? { ...o, mediaIndex: i } : o))}
        />
      )}

      {/* «Смотреть подряд»: вертикальный свайп-просмотр (лайки общие с лентой). */}
      {flowOpen && view.length > 0 && (
        <LentaFlow
          items={view}
          likedIds={likedIds}
          onToggleLike={toggleLike}
          onClose={() => {
            setFlowOpen(false)
            // снять #flow, чтобы повторный переход снова открыл просмотр
            if (window.location.hash === '#flow') history.replaceState(null, '', window.location.pathname)
          }}
        />
      )}
    </div>
  )
}

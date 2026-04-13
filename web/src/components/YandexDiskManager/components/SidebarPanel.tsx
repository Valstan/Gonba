import React from 'react'

type Props = {
  sidebarWidth: number
  tree: React.ReactNode
  children: React.ReactNode
  onCreateFolder: () => void
  onOpenTrash: () => void
  onTrashDrop: (event: React.DragEvent) => void
  onStartResize: (event: React.MouseEvent<HTMLDivElement>) => void
  onResetResize: () => void
}

export const SidebarPanel: React.FC<Props> = ({
  sidebarWidth,
  tree,
  children,
  onCreateFolder,
  onOpenTrash,
  onTrashDrop,
  onStartResize,
  onResetResize,
}) => {
  const layoutStyle = { '--yadisk-sidebar-width': `${sidebarWidth}px` } as React.CSSProperties

  return (
    <div className="yadisk__layout" style={layoutStyle}>
      <aside className="yadisk__sidebar rounded-2xl border bg-card p-4 shadow-sm">
        <div className="yadisk__sidebar-title text-sm font-semibold">Папки</div>
        <button
          className="yadisk__button yadisk__button--primary yadisk__sidebar-add mt-3"
          type="button"
          onClick={onCreateFolder}
        >
          Добавить папку
        </button>
        <div className="yadisk__tree mt-3">{tree}</div>
        <div
          className="yadisk__trash rounded-2xl border bg-card p-4 shadow-sm"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onTrashDrop}
          onClick={onOpenTrash}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              onOpenTrash()
            }
          }}
        >
          <div className="yadisk__trash-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M3 6h18M8 6v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M10 11v6M14 11v6" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="yadisk__trash-content">
            <div className="yadisk__trash-title">Корзина</div>
            <div className="yadisk__trash-subtitle">Перетащите файлы или папки сюда</div>
            <div className="yadisk__trash-hint">Хранение 10 дней</div>
          </div>
        </div>
      </aside>

      <div
        className="yadisk__splitter"
        onMouseDown={onStartResize}
        onDoubleClick={onResetResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину панели папок"
      />

      <div className="yadisk__main space-y-6">{children}</div>
    </div>
  )
}

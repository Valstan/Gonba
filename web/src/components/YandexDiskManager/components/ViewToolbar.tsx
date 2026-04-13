import React from 'react'

import type { PreviewSize, SortDirection, SortField, ViewMode } from '../hooks/useYadiskLayoutControls'

type Props = {
  viewMode: ViewMode
  previewSize: PreviewSize
  sortField: SortField
  sortDirection: SortDirection
  onViewModeChange: (value: ViewMode) => void
  onPreviewSizeChange: (value: PreviewSize) => void
  onSortFieldChange: (value: SortField) => void
  onSortDirectionChange: (value: SortDirection) => void
}

export const ViewToolbar: React.FC<Props> = ({
  viewMode,
  previewSize,
  sortField,
  sortDirection,
  onViewModeChange,
  onPreviewSizeChange,
  onSortFieldChange,
  onSortDirectionChange,
}) => {
  return (
    <div className="yadisk__view yadisk__token-toolbar">
      <span className="yadisk__toolbar-label">Вид:</span>
      <div className="yadisk__view-toggle">
        <button
          className={`yadisk__view-button ${viewMode === 'table' ? 'is-active' : ''}`}
          onClick={() => onViewModeChange('table')}
          type="button"
        >
          Таблица
        </button>
        <button
          className={`yadisk__view-button ${viewMode === 'list' ? 'is-active' : ''}`}
          onClick={() => onViewModeChange('list')}
          type="button"
        >
          Список
        </button>
        <button
          className={`yadisk__view-button ${viewMode === 'preview' ? 'is-active' : ''}`}
          onClick={() => onViewModeChange('preview')}
          type="button"
        >
          Превью
        </button>
      </div>

      {viewMode === 'preview' && (
        <>
          <span className="yadisk__toolbar-label">Размер:</span>
          <div className="yadisk__view-toggle">
            <button
              className={`yadisk__view-button ${previewSize === 'sm' ? 'is-active' : ''}`}
              onClick={() => onPreviewSizeChange('sm')}
              type="button"
            >
              Маленькие
            </button>
            <button
              className={`yadisk__view-button ${previewSize === 'md' ? 'is-active' : ''}`}
              onClick={() => onPreviewSizeChange('md')}
              type="button"
            >
              Средние
            </button>
            <button
              className={`yadisk__view-button ${previewSize === 'lg' ? 'is-active' : ''}`}
              onClick={() => onPreviewSizeChange('lg')}
              type="button"
            >
              Большие
            </button>
          </div>
        </>
      )}

      <span className="yadisk__toolbar-label">Сортировка:</span>
      <div className="yadisk__view-toggle">
        <button
          className={`yadisk__view-button ${sortField === 'created' ? 'is-active' : ''}`}
          onClick={() => onSortFieldChange('created')}
          type="button"
        >
          По дате
        </button>
        <button
          className={`yadisk__view-button ${sortField === 'size' ? 'is-active' : ''}`}
          onClick={() => onSortFieldChange('size')}
          type="button"
        >
          По размеру
        </button>
        <button
          className={`yadisk__view-button ${sortField === 'name' ? 'is-active' : ''}`}
          onClick={() => onSortFieldChange('name')}
          type="button"
        >
          По имени
        </button>
        <button
          className={`yadisk__view-button ${sortField === 'type' ? 'is-active' : ''}`}
          onClick={() => onSortFieldChange('type')}
          type="button"
        >
          По типу
        </button>
      </div>
      <div className="yadisk__view-toggle">
        <button
          className={`yadisk__view-button ${sortDirection === 'asc' ? 'is-active' : ''}`}
          onClick={() => onSortDirectionChange('asc')}
          type="button"
        >
          ↑
        </button>
        <button
          className={`yadisk__view-button ${sortDirection === 'desc' ? 'is-active' : ''}`}
          onClick={() => onSortDirectionChange('desc')}
          type="button"
        >
          ↓
        </button>
      </div>
    </div>
  )
}

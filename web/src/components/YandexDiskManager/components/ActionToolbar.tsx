import React from 'react'

type UploadBehavior = 'overwrite' | 'skip'

type Props = {
  uploadBehavior: UploadBehavior
  onUploadBehaviorChange: (behavior: UploadBehavior) => void
  onUploadFiles: () => void
  onUploadImages: () => void
  onSelectAllFiles: () => void
  onClearSelection: () => void
  hasFiles: boolean
  hasSelection: boolean
}

export const ActionToolbar: React.FC<Props> = ({
  uploadBehavior,
  onUploadBehaviorChange,
  onUploadFiles,
  onUploadImages,
  onSelectAllFiles,
  onClearSelection,
  hasFiles,
  hasSelection,
}) => {
  return (
    <div className="yadisk__actions">
      <button className="yadisk__button yadisk__button--primary" type="button" onClick={onUploadFiles}>
        Загрузить файлы
      </button>
      <button className="yadisk__button yadisk__button--success" type="button" onClick={onUploadImages}>
        Загрузить изображения
      </button>
      <div className="yadisk__upload-mode">
        <span>При совпадении имени:</span>
        <div className="yadisk__view-toggle">
          <button
            type="button"
            className={`yadisk__view-button ${uploadBehavior === 'skip' ? 'is-active' : ''}`}
            onClick={() => onUploadBehaviorChange('skip')}
          >
            Пропустить
          </button>
          <button
            type="button"
            className={`yadisk__view-button ${uploadBehavior === 'overwrite' ? 'is-active' : ''}`}
            onClick={() => onUploadBehaviorChange('overwrite')}
          >
            Перезаписать
          </button>
        </div>
      </div>
      <button
        className="yadisk__button yadisk__button--outline"
        type="button"
        onClick={onSelectAllFiles}
        disabled={!hasFiles}
      >
        Выделить все
      </button>
      <button
        className="yadisk__button yadisk__button--outline"
        type="button"
        onClick={onClearSelection}
        disabled={!hasSelection}
      >
        Снять выделение
      </button>
    </div>
  )
}

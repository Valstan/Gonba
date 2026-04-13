import React from 'react'

type Props = {
  breadcrumbs: string[]
  onOpenFolder: (path: string) => void
}

export const Breadcrumbs: React.FC<Props> = ({ breadcrumbs, onOpenFolder }) => {
  return (
    <div className="yadisk__breadcrumbs yadisk__token-toolbar">
      {breadcrumbs.map((crumb, index) => {
        const isActive = index === breadcrumbs.length - 1
        return (
          <button
            key={crumb || 'root'}
            className={`yadisk__breadcrumb ${isActive ? 'yadisk__breadcrumb--active' : ''}`}
            onClick={() => onOpenFolder(crumb || '/')}
            type="button"
          >
            {index === 0 ? 'Корень' : crumb.split('/').pop()}
          </button>
        )
      })}
    </div>
  )
}

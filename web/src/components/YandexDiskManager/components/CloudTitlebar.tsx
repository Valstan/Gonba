import Link from 'next/link'
import React from 'react'

type Props = {
  pickerMode: boolean
}

export const CloudTitlebar: React.FC<Props> = ({ pickerMode }) => {
  return (
    <div className="yadisk__titlebar">
      {pickerMode ? (
        <h1 className="yadisk__title">Выберите изображение из Облака</h1>
      ) : (
        <span />
      )}
      <Link href="/" prefetch={false} className="yadisk__back-link">
        Вернуться на сайт
      </Link>
    </div>
  )
}

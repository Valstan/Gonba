import Link from 'next/link'
import React from 'react'

type Props = {
  pickerMode: boolean
}

export const CloudTitlebar: React.FC<Props> = ({ pickerMode }) => {
  return (
    <div className="yadisk__titlebar">
      <h1 className="yadisk__title">
        {pickerMode ? 'Выберите изображение из Облака' : 'Файловое облако Жемчужины'}
      </h1>
      <Link href="/" prefetch={false} className="yadisk__back-link">
        Вернуться на сайт
      </Link>
    </div>
  )
}

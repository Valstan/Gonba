'use client'

import React, { useEffect, useRef } from 'react'

type Props = {
  /** Стартовый HTML (из lexicalToHtml). Применяется один раз при монтировании. */
  initialHtml: string
  /** Вызывается с текущим HTML при каждом изменении. */
  onChange: (html: string) => void
}

const toolbarBtn =
  'inline-flex h-8 min-w-8 items-center justify-center rounded border border-input bg-background px-2 text-sm font-medium hover:bg-accent'

/**
 * Лёгкий rich-text редактор на contentEditable + execCommand.
 * Поддерживает жирный/курсив/H2/списки/ссылки/абзац. HTML наружу → потом
 * сериализуется в Lexical через htmlToLexical.
 */
export const LiteRichTextEditor: React.FC<Props> = ({ initialHtml, onChange }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialHtml || '<p><br></p>'
    }
    // только при монтировании — contentEditable далее неуправляемый, чтобы не прыгал курсор
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const exec = (command: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, value)
    emit()
  }

  const addLink = () => {
    const url = window.prompt('Ссылка (URL):', 'https://')
    if (url) exec('createLink', url)
  }

  return (
    <div className="rounded-md border border-input">
      <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/40 p-1.5">
        <button type="button" className={toolbarBtn} onClick={() => exec('bold')} title="Жирный">
          <strong>Ж</strong>
        </button>
        <button type="button" className={toolbarBtn} onClick={() => exec('italic')} title="Курсив">
          <em>К</em>
        </button>
        <button type="button" className={toolbarBtn} onClick={() => exec('formatBlock', 'h2')} title="Заголовок">
          H2
        </button>
        <button type="button" className={toolbarBtn} onClick={() => exec('formatBlock', 'p')} title="Обычный абзац">
          ¶
        </button>
        <button type="button" className={toolbarBtn} onClick={() => exec('insertUnorderedList')} title="Маркированный список">
          • —
        </button>
        <button type="button" className={toolbarBtn} onClick={() => exec('insertOrderedList')} title="Нумерованный список">
          1.
        </button>
        <button type="button" className={toolbarBtn} onClick={addLink} title="Ссылка">
          🔗
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="prose prose-sm max-w-none min-h-[180px] px-3 py-2 focus:outline-none"
      />
    </div>
  )
}

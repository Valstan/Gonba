/**
 * Лёгкая конвертация rich-text (Lexical) ↔ HTML для on-site редактора.
 *
 * Поддерживает: абзацы, заголовки (h2/h3), жирный, курсив, ссылки,
 * маркированные/нумерованные списки, переносы строк. Этого хватает для ~95%
 * правок «на ходу».
 *
 * Всё остальное (блоки mediaBlock/banner/cta/code, upload, horizontalrule и пр.)
 * считается «неподдержанным»: тогда редактор тела не предлагается, а правка идёт
 * через /admin (см. hasUnsupportedNodes). Так мы НЕ теряем сложный контент.
 *
 * Используется только в браузере (DOMParser) из client-компонента редактора.
 */

const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2

type LexNode = { type?: string; [k: string]: unknown }
type LexRoot = { root?: { children?: LexNode[]; [k: string]: unknown } }

/** Блочные типы верхнего уровня, которые умеет редактор. */
const SUPPORTED_TOP_TYPES = new Set(['paragraph', 'heading', 'list', 'horizontalrule', 'linebreak'])

/** true, если контент содержит узлы верхнего уровня, которые редактор не умеет. */
export function hasUnsupportedNodes(state: unknown): boolean {
  const root = (state as LexRoot)?.root
  if (!root || !Array.isArray(root.children)) return false
  // horizontalrule поддерживаем на чтение (рендерим как <hr>), но при сериализации
  // обратно его не теряем только если он один из немногих — для простоты считаем
  // именно блоки/upload неподдерживаемыми.
  return root.children.some((n) => {
    const t = typeof n?.type === 'string' ? n.type : ''
    if (t === 'block' || t === 'upload' || t === 'relationship') return true
    return !SUPPORTED_TOP_TYPES.has(t)
  })
}

export function isEmptyLexical(state: unknown): boolean {
  const root = (state as LexRoot)?.root
  return !root || !Array.isArray(root.children) || root.children.length === 0
}

// ---------------------------------------------------------------------------
// Lexical → HTML (для загрузки существующего контента в contentEditable)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

function inlineToHtml(children: unknown): string {
  if (!Array.isArray(children)) return ''
  let out = ''
  for (const raw of children as LexNode[]) {
    const type = raw?.type
    if (type === 'text') {
      const text = escapeHtml(String(raw.text ?? ''))
      const fmt = typeof raw.format === 'number' ? raw.format : 0
      let html = text
      if (fmt & FORMAT_BOLD) html = `<strong>${html}</strong>`
      if (fmt & FORMAT_ITALIC) html = `<em>${html}</em>`
      out += html
    } else if (type === 'linebreak') {
      out += '<br>'
    } else if (type === 'link' || type === 'autolink') {
      const fields = (raw.fields as { url?: string } | undefined) ?? {}
      const url = escapeAttr(String(fields.url ?? '#'))
      out += `<a href="${url}">${inlineToHtml(raw.children)}</a>`
    }
  }
  return out
}

/** Сериализует Lexical-состояние в HTML для редактируемой области. */
export function lexicalToHtml(state: unknown): string {
  const root = (state as LexRoot)?.root
  if (!root || !Array.isArray(root.children)) return ''
  let out = ''
  for (const node of root.children) {
    const type = node?.type
    if (type === 'paragraph') {
      const inner = inlineToHtml(node.children)
      out += inner ? `<p>${inner}</p>` : '<p><br></p>'
    } else if (type === 'heading') {
      const tag = node.tag === 'h3' ? 'h3' : 'h2'
      out += `<${tag}>${inlineToHtml(node.children)}</${tag}>`
    } else if (type === 'list') {
      const tag = node.tag === 'ol' || node.listType === 'number' ? 'ol' : 'ul'
      const items = Array.isArray(node.children) ? (node.children as LexNode[]) : []
      const lis = items.map((li) => `<li>${inlineToHtml(li.children)}</li>`).join('')
      out += `<${tag}>${lis}</${tag}>`
    } else if (type === 'horizontalrule') {
      out += '<hr>'
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// HTML → Lexical (для сохранения отредактированного contentEditable)
// ---------------------------------------------------------------------------

function textNode(text: string, format: number): LexNode {
  return { type: 'text', detail: 0, format, mode: 'normal', style: '', text, version: 1 }
}

function serializeInline(el: Node, inheritedFormat: number): LexNode[] {
  const result: LexNode[] = []
  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? ''
      if (text.length > 0) result.push(textNode(text, inheritedFormat))
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const e = child as HTMLElement
    const tag = e.tagName.toLowerCase()
    if (tag === 'br') {
      result.push({ type: 'linebreak', version: 1 })
      return
    }
    if (tag === 'strong' || tag === 'b') {
      result.push(...serializeInline(e, inheritedFormat | FORMAT_BOLD))
      return
    }
    if (tag === 'em' || tag === 'i') {
      result.push(...serializeInline(e, inheritedFormat | FORMAT_ITALIC))
      return
    }
    if (tag === 'a') {
      const url = e.getAttribute('href') || '#'
      result.push({
        type: 'link',
        fields: { linkType: 'custom', newTab: false, url },
        children: serializeInline(e, inheritedFormat),
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 2,
      })
      return
    }
    // Прочие inline-обёртки (span и т.п.) — раскрываем содержимое.
    result.push(...serializeInline(e, inheritedFormat))
  })
  return result
}

function paragraphNode(children: LexNode[]): LexNode {
  return {
    type: 'paragraph',
    children: children.length ? children : [],
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    version: 1,
  }
}

function listNode(tag: 'ul' | 'ol', el: HTMLElement): LexNode {
  const items: LexNode[] = []
  let value = 1
  el.querySelectorAll(':scope > li').forEach((li) => {
    items.push({
      type: 'listitem',
      value: value++,
      children: serializeInline(li, 0),
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    })
  })
  return {
    type: 'list',
    listType: tag === 'ol' ? 'number' : 'bullet',
    start: 1,
    tag,
    children: items,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

/** Разбирает HTML из contentEditable в Lexical-состояние. */
export function htmlToLexical(html: string): { root: LexNode } {
  const children: LexNode[] = []
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body

  const pushParagraphFromInline = (node: Node) => {
    const inline = serializeInline(node, 0)
    // Пропускаем абзацы, где только пустой текст
    children.push(paragraphNode(inline))
  }

  body.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').trim()
      if (text) children.push(paragraphNode([textNode(text, 0)]))
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const e = child as HTMLElement
    const tag = e.tagName.toLowerCase()
    if (tag === 'p' || tag === 'div') {
      pushParagraphFromInline(e)
    } else if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      children.push({
        type: 'heading',
        tag: tag === 'h3' || tag === 'h4' ? 'h3' : 'h2',
        children: serializeInline(e, 0),
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      })
    } else if (tag === 'ul') {
      children.push(listNode('ul', e))
    } else if (tag === 'ol') {
      children.push(listNode('ol', e))
    } else if (tag === 'hr') {
      children.push({ type: 'horizontalrule', version: 1 })
    } else if (tag === 'br') {
      children.push(paragraphNode([]))
    } else {
      // Неизвестный блок — сохраняем как абзац с его текстом, чтобы не терять.
      pushParagraphFromInline(e)
    }
  })

  if (children.length === 0) children.push(paragraphNode([]))

  return {
    root: {
      type: 'root',
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

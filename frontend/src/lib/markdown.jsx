/**
 * Parse markdown-like formatting and convert to React components
 * Handles: **bold**, *italic*, `code`
 */
export function parseMarkdown(text) {
  const parts = []
  let lastEnd = 0
  
  // Pattern for **bold**, *italic*, `code`
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g
  let match

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastEnd) {
      parts.push({ type: 'text', content: text.slice(lastEnd, match.index) })
    }

    // Add the formatted part
    if (match[1]) {
      parts.push({ type: 'bold', content: match[1] })
    } else if (match[2]) {
      parts.push({ type: 'italic', content: match[2] })
    } else if (match[3]) {
      parts.push({ type: 'code', content: match[3] })
    }

    lastEnd = pattern.lastIndex
  }

  // Add remaining text
  if (lastEnd < text.length) {
    parts.push({ type: 'text', content: text.slice(lastEnd) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }]
}

export function renderParsedMarkdown(parts) {
  return parts.map((part, i) => {
    switch (part.type) {
      case 'bold':
        return <strong key={i} className="font-bold">{part.content}</strong>
      case 'italic':
        return <em key={i} className="italic">{part.content}</em>
      case 'code':
        return <code key={i} className="bg-gray-200 px-1 py-0.5 rounded text-sm font-mono">{part.content}</code>
      default:
        return <span key={i}>{part.content}</span>
    }
  })
}

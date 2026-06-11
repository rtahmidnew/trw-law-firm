import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { useEffect } from 'react'

// ─── Toolbar button ───────────────────────────────────────────────────────────
function Btn({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 5, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: active ? '#0d1b2a' : 'transparent',
        color: active ? '#fff' : '#374151',
        fontSize: 13, fontWeight: 600,
        transition: 'background 0.1s, color 0.1s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Sep() {
  return <span style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 4px', display: 'inline-block', flexShrink: 0 }} />
}

// ─── Text colour presets ──────────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Black', value: '#000000' },
  { label: 'Dark grey', value: '#374151' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
]

const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
]

// ─── SVG icons ────────────────────────────────────────────────────────────────
const IconBold = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 0 1 0 8H6V4zm0 8h9a4 4 0 0 1 0 8H6v-8z"/></svg>
const IconItalic = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.49 3l-4 18H5l4-18h2.49zM19 3v2h-2.49l-4 18H15v2H5v-2h2.49l4-18H9V3h10z"/></svg>
const IconUnderline = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
const IconStrike = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.85 7.08C6.85 4.37 9.45 3 12.24 3c1.64 0 3 .49 3.9 1.28.77.65 1.46 1.73 1.46 3.24h-3.01c0-.31-.05-.59-.15-.85-.29-.86-1.2-1.28-2.25-1.28-1.86 0-2.34.92-2.34 1.69 0 .48.25.88.74 1.21L12 9h-1.55C8.01 8.95 6.85 7.86 6.85 7.08zM21 12H3v-2h18v2zm-7.66 1h3.18c.22.46.33.97.33 1.53 0 1.54-.94 2.91-2.84 3.51-.86.27-1.78.41-2.76.41-2.23 0-4.19-.6-5.12-1.95-.38-.55-.59-1.21-.59-1.97h3.01c0 .28.08.55.25.78.44.6 1.33.87 2.46.87 1.55 0 2.58-.48 2.58-1.53 0-.28-.07-.53-.5-.65z"/></svg>
const IconUL = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zM20 7H8V5h12v2zm0 5H8v-2h12v2zm0 5H8v-2h12v2z"/></svg>
const IconOL = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>
const IconAlignL = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>
const IconAlignC = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>
const IconAlignR = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>
const IconH1 = () => <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: -0.5 }}>H1</span>
const IconH2 = () => <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: -0.5 }}>H2</span>
const IconH3 = () => <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: -0.5 }}>H3</span>
const IconQuote = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
const IconCode = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
const IconUndo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
const IconRedo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>

// ─── Main component ───────────────────────────────────────────────────────────
export default function RichEditor({ value, onChange, placeholder, minHeight = 120 }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        style: `min-height:${minHeight}px; padding: 10px 12px; outline: none; font-size: 14px; line-height: 1.7; font-family: inherit; color: #1a202c;`,
      },
    },
  })

  // Sync external value changes (e.g. when editing an existing entry)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '', false)
    }
  }, [value])

  if (!editor) return null

  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      overflow: 'hidden',
      background: '#fff',
    }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2,
        padding: '6px 8px', borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}>
        {/* History */}
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><IconUndo /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><IconRedo /></Btn>
        <Sep />

        {/* Headings */}
        <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><IconH1 /></Btn>
        <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><IconH2 /></Btn>
        <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><IconH3 /></Btn>
        <Sep />

        {/* Inline formatting */}
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><IconBold /></Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><IconItalic /></Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><IconUnderline /></Btn>
        <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><IconStrike /></Btn>
        <Btn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code"><IconCode /></Btn>
        <Sep />

        {/* Text colour */}
        <span title="Text colour" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, userSelect: 'none' }}>A</span>
          <select
            value={editor.getAttributes('textStyle').color || ''}
            onChange={e => {
              if (e.target.value) {
                editor.chain().focus().setColor(e.target.value).run()
              } else {
                editor.chain().focus().unsetColor().run()
              }
            }}
            style={{
              fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 4,
              padding: '2px 4px', background: '#fff', cursor: 'pointer',
              color: '#374151', height: 24,
            }}
          >
            {TEXT_COLORS.map(c => (
              <option key={c.value} value={c.value} style={{ color: c.value || '#374151' }}>
                {c.label}
              </option>
            ))}
          </select>
        </span>
        <Sep />

        {/* Highlight */}
        <span title="Highlight colour" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, userSelect: 'none' }}>HL</span>
          <select
            value={editor.getAttributes('highlight').color || ''}
            onChange={e => {
              if (e.target.value) {
                editor.chain().focus().setHighlight({ color: e.target.value }).run()
              } else {
                editor.chain().focus().unsetHighlight().run()
              }
            }}
            style={{
              fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 4,
              padding: '2px 4px', background: '#fff', cursor: 'pointer',
              color: '#374151', height: 24,
            }}
          >
            {HIGHLIGHT_COLORS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </span>
        <Sep />

        {/* Lists */}
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><IconUL /></Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><IconOL /></Btn>
        <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote"><IconQuote /></Btn>
        <Sep />

        {/* Alignment */}
        <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left"><IconAlignL /></Btn>
        <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align centre"><IconAlignC /></Btn>
        <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right"><IconAlignR /></Btn>
      </div>

      {/* ── Editor area ── */}
      <div
        onClick={() => editor.commands.focus()}
        style={{ cursor: 'text', position: 'relative' }}
      >
        {/* Placeholder */}
        {editor.isEmpty && placeholder && (
          <span style={{
            position: 'absolute', top: 10, left: 12,
            color: '#9ca3af', fontSize: 14, pointerEvents: 'none',
            userSelect: 'none',
          }}>
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror { outline: none; }
        .ProseMirror p { margin: 0 0 8px; }
        .ProseMirror p:last-child { margin-bottom: 0; }
        .ProseMirror h1 { font-size: 1.4em; font-weight: 700; margin: 12px 0 6px; }
        .ProseMirror h2 { font-size: 1.2em; font-weight: 700; margin: 10px 0 5px; }
        .ProseMirror h3 { font-size: 1.05em; font-weight: 700; margin: 8px 0 4px; }
        .ProseMirror ul { padding-left: 20px; margin: 6px 0; list-style-type: disc; }
        .ProseMirror ol { padding-left: 20px; margin: 6px 0; list-style-type: decimal; }
        .ProseMirror li { margin: 2px 0; }
        .ProseMirror blockquote { border-left: 3px solid #cbd5e1; margin: 8px 0; padding-left: 12px; color: #64748b; }
        .ProseMirror code { background: #f1f5f9; border-radius: 3px; padding: 1px 4px; font-size: 0.9em; font-family: monospace; }
        .ProseMirror pre { background: #1e293b; color: #e2e8f0; border-radius: 6px; padding: 12px; margin: 8px 0; overflow-x: auto; }
        .ProseMirror pre code { background: none; color: inherit; }
        .ProseMirror mark { border-radius: 2px; padding: 0 2px; }
        .ProseMirror hr { border: none; border-top: 2px solid #e2e8f0; margin: 12px 0; }
      `}</style>
    </div>
  )
}

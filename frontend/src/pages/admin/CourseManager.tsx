import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { VA_TRAINING_COURSE } from '../../data/vaTrainingCourse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'heading'; content: string }
  | { type: 'subheading'; content: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'callout'; content: string; variant: 'info' | 'warning' | 'tip' | 'important' }
  | { type: 'script'; label: string; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'comparison'; doItems: string[]; dontItems: string[] };

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type Slide = {
  title: string;
  subtitle?: string;
  content: ContentBlock[];
};

type Module = {
  id: string;
  title: string;
  description: string;
  icon: string;
  slides: Slide[];
  quiz: QuizQuestion[];
};

type Course = {
  id: string;
  slug: string;
  title: string;
  description: string;
  target_roles: string[];
  is_published: boolean;
  content: Module[];
  module_count?: number;
  created_at: string;
  updated_at: string;
};

type CoursePayload = {
  slug: string;
  title: string;
  description: string;
  target_roles: string[];
  is_published: boolean;
  content: Module[];
};

const ROLES = [
  { value: 'va', label: 'VA' },
  { value: 'closer', label: 'Closer' },
  { value: 'ops', label: 'Ops' },
  { value: 'admin', label: 'Admin' },
];

const BLOCK_TYPES: { value: ContentBlock['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'heading', label: 'Heading' },
  { value: 'subheading', label: 'Subheading' },
  { value: 'bullets', label: 'Bullet List' },
  { value: 'callout', label: 'Callout' },
  { value: 'script', label: 'Script' },
  { value: 'table', label: 'Table' },
  { value: 'comparison', label: 'Do / Don\'t Comparison' },
];

const MODULE_ICONS = [
  'BookOpen', 'Phone', 'Target', 'Shield', 'Zap', 'Users',
  'Star', 'Award', 'Briefcase', 'Settings', 'Globe', 'Mic',
];

function genId() {
  return `module-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

function Spinner({ className = 'h-10 w-10' }: { className?: string }) {
  return <div className={`${className} animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent`} />;
}

function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = 'Confirm',
  className = '',
}: {
  onConfirm: () => void;
  label: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return pending ? (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={() => { setPending(false); onConfirm(); }}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
      >
        {confirmLabel}
      </button>
      <button
        onClick={() => setPending(false)}
        className="rounded-lg border border-gray-300 dark:border-[#262626] px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111]"
      >
        Cancel
      </button>
    </span>
  ) : (
    <button onClick={() => setPending(true)} className={className}>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Content Block Editor
// ---------------------------------------------------------------------------

function ContentBlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
  onRemove: () => void;
}) {
  const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide';
  const inputClass =
    'w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500';
  const tagClass =
    'inline-block rounded bg-gray-100 dark:bg-[#111] px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300';

  function renderListEditor(items: string[], setItems: (v: string[]) => void, placeholder: string) {
    return (
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputClass}
              value={item}
              onChange={(e) => { const c = [...items]; c[i] = e.target.value; setItems(c); }}
              placeholder={placeholder}
            />
            <button
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              className="shrink-0 rounded-lg border border-gray-300 dark:border-[#262626] px-2 text-gray-400 hover:text-red-500"
              title="Remove item"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          onClick={() => setItems([...items, ''])}
          className="text-xs font-medium text-neutral-700 hover:text-neutral-800"
        >
          + Add item
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0a0a0a] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className={tagClass}>{block.type}</span>
        <ConfirmButton
          onConfirm={onRemove}
          label="Remove"
          className="text-xs text-red-500 hover:text-red-700"
        />
      </div>

      {(block.type === 'text' || block.type === 'heading' || block.type === 'subheading') && (
        <textarea
          className={inputClass}
          rows={block.type === 'text' ? 3 : 1}
          value={block.content}
          onChange={(e) => onChange({ ...block, content: e.target.value })}
          placeholder={`${block.type} content...`}
        />
      )}

      {block.type === 'bullets' && renderListEditor(
        block.items,
        (items) => onChange({ ...block, items }),
        'Bullet item',
      )}

      {block.type === 'callout' && (
        <>
          <select
            className={inputClass}
            value={block.variant}
            onChange={(e) => onChange({ ...block, variant: e.target.value as 'info' | 'warning' | 'tip' | 'important' })}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="tip">Tip</option>
            <option value="important">Important</option>
          </select>
          <textarea
            className={inputClass}
            rows={2}
            value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            placeholder="Callout content..."
          />
        </>
      )}

      {block.type === 'script' && (
        <>
          <div>
            <label className={labelClass}>Label</label>
            <input
              className={inputClass}
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              placeholder="e.g. Opening Line"
            />
          </div>
          <div>
            <label className={labelClass}>Script Content</label>
            <textarea
              className={inputClass}
              rows={4}
              value={block.content}
              onChange={(e) => onChange({ ...block, content: e.target.value })}
              placeholder="The script text..."
            />
          </div>
        </>
      )}

      {block.type === 'table' && (
        <TableBlockEditor
          headers={block.headers}
          rows={block.rows}
          onChange={(headers, rows) => onChange({ ...block, headers, rows })}
        />
      )}

      {block.type === 'comparison' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Do</label>
            {renderListEditor(block.doItems, (v) => onChange({ ...block, doItems: v }), 'Do item')}
          </div>
          <div>
            <label className={labelClass}>Don't</label>
            {renderListEditor(block.dontItems, (v) => onChange({ ...block, dontItems: v }), "Don't item")}
          </div>
        </div>
      )}
    </div>
  );
}

function TableBlockEditor({
  headers,
  rows,
  onChange,
}: {
  headers: string[];
  rows: string[][];
  onChange: (h: string[], r: string[][]) => void;
}) {
  const inputClass =
    'w-full rounded border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-2 py-1 text-xs text-gray-900 dark:text-gray-100';

  function setHeader(i: number, v: string) {
    const h = [...headers];
    h[i] = v;
    onChange(h, rows);
  }

  function setCell(ri: number, ci: number, v: string) {
    const r = rows.map((row) => [...row]);
    r[ri][ci] = v;
    onChange(headers, r);
  }

  function addColumn() {
    onChange([...headers, ''], rows.map((r) => [...r, '']));
  }

  function removeColumn(ci: number) {
    onChange(headers.filter((_, i) => i !== ci), rows.map((r) => r.filter((_, i) => i !== ci)));
  }

  function addRow() {
    onChange(headers, [...rows, headers.map(() => '')]);
  }

  function removeRow(ri: number) {
    onChange(headers, rows.filter((_, i) => i !== ri));
  }

  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="pr-1 pb-1">
                <div className="flex gap-1">
                  <input className={inputClass} value={h} onChange={(e) => setHeader(i, e.target.value)} placeholder="Header" />
                  {headers.length > 1 && (
                    <button onClick={() => removeColumn(i)} className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                  )}
                </div>
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="pr-1 pb-1">
                  <input className={inputClass} value={cell} onChange={(e) => setCell(ri, ci, e.target.value)} />
                </td>
              ))}
              <td>
                <button onClick={() => removeRow(ri)} className="text-red-400 hover:text-red-600 text-xs">&times;</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3">
        <button onClick={addColumn} className="text-xs font-medium text-neutral-700 hover:text-neutral-800">+ Column</button>
        <button onClick={addRow} className="text-xs font-medium text-neutral-700 hover:text-neutral-800">+ Row</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide Editor
// ---------------------------------------------------------------------------

function SlideEditor({
  slide,
  index,
  onChange,
  onRemove,
}: {
  slide: Slide;
  index: number;
  onChange: (s: Slide) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [addBlockType, setAddBlockType] = useState<ContentBlock['type']>('text');
  const inputClass =
    'w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500';

  function updateBlock(bi: number, b: ContentBlock) {
    const c = [...slide.content];
    c[bi] = b;
    onChange({ ...slide, content: c });
  }

  function removeBlock(bi: number) {
    onChange({ ...slide, content: slide.content.filter((_, i) => i !== bi) });
  }

  function addBlock() {
    let newBlock: ContentBlock;
    switch (addBlockType) {
      case 'text': newBlock = { type: 'text', content: '' }; break;
      case 'heading': newBlock = { type: 'heading', content: '' }; break;
      case 'subheading': newBlock = { type: 'subheading', content: '' }; break;
      case 'bullets': newBlock = { type: 'bullets', items: [''] }; break;
      case 'callout': newBlock = { type: 'callout', content: '', variant: 'info' }; break;
      case 'script': newBlock = { type: 'script', label: '', content: '' }; break;
      case 'table': newBlock = { type: 'table', headers: ['Column 1'], rows: [[''] ] }; break;
      case 'comparison': newBlock = { type: 'comparison', doItems: [''], dontItems: [''] }; break;
      default: return;
    }
    onChange({ ...slide, content: [...slide.content, newBlock] });
  }

  function moveBlock(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= slide.content.length) return;
    const c = [...slide.content];
    [c[from], c[to]] = [c[to], c[from]];
    onChange({ ...slide, content: c });
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#111]"
      >
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Slide {index + 1}: {slide.title || '(untitled)'}
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-200 dark:border-[#1a1a1a] px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input
                className={inputClass}
                value={slide.title}
                onChange={(e) => onChange({ ...slide, title: e.target.value })}
                placeholder="Slide title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subtitle</label>
              <input
                className={inputClass}
                value={slide.subtitle || ''}
                onChange={(e) => onChange({ ...slide, subtitle: e.target.value || undefined })}
                placeholder="Optional subtitle"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Content Blocks ({slide.content.length})</h4>
            {slide.content.map((block, bi) => (
              <div key={bi} className="relative">
                <div className="absolute -left-7 top-1 flex flex-col gap-0.5">
                  {bi > 0 && (
                    <button onClick={() => moveBlock(bi, -1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Move up">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    </button>
                  )}
                  {bi < slide.content.length - 1 && (
                    <button onClick={() => moveBlock(bi, 1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Move down">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  )}
                </div>
                <ContentBlockEditor
                  block={block}
                  onChange={(b) => updateBlock(bi, b)}
                  onRemove={() => removeBlock(bi)}
                />
              </div>
            ))}

            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                value={addBlockType}
                onChange={(e) => setAddBlockType(e.target.value as ContentBlock['type'])}
              >
                {BLOCK_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
              <button
                onClick={addBlock}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Add Block
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-[#1a1a1a]">
            <ConfirmButton
              onConfirm={onRemove}
              label="Remove Slide"
              className="text-sm text-red-500 hover:text-red-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz Editor
// ---------------------------------------------------------------------------

function QuizEditor({
  questions,
  onChange,
}: {
  questions: QuizQuestion[];
  onChange: (q: QuizQuestion[]) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const inputClass =
    'w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500';

  function update(i: number, patch: Partial<QuizQuestion>) {
    const q = [...questions];
    q[i] = { ...q[i], ...patch };
    onChange(q);
  }

  function remove(i: number) {
    onChange(questions.filter((_, j) => j !== i));
  }

  function add() {
    onChange([...questions, { question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' }]);
    setOpenIndex(questions.length);
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No quiz questions yet.</p>
      )}

      {questions.map((q, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] overflow-hidden">
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#111]"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Q{i + 1}: {q.question || '(no question text)'}
              </span>
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className="border-t border-gray-200 dark:border-[#1a1a1a] px-4 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={q.question}
                    onChange={(e) => update(i, { question: e.target.value })}
                    placeholder="Enter the question..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Options</label>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-bold text-gray-500 dark:text-gray-400">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <input
                        className={inputClass}
                        value={opt}
                        onChange={(e) => {
                          const opts = [...q.options];
                          opts[oi] = e.target.value;
                          update(i, { options: opts });
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correct Answer</label>
                    <select
                      className={inputClass}
                      value={q.correctIndex}
                      onChange={(e) => update(i, { correctIndex: Number(e.target.value) })}
                    >
                      {q.options.map((_, oi) => (
                        <option key={oi} value={oi}>{String.fromCharCode(65 + oi)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Explanation</label>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={q.explanation}
                    onChange={(e) => update(i, { explanation: e.target.value })}
                    placeholder="Why this answer is correct..."
                  />
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-[#1a1a1a]">
                  <ConfirmButton
                    onConfirm={() => remove(i)}
                    label="Remove Question"
                    className="text-sm text-red-500 hover:text-red-700"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={add}
        className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Question
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module Editor (main content area)
// ---------------------------------------------------------------------------

function ModuleEditor({
  module: mod,
  onChange,
  onDelete,
}: {
  module: Module;
  onChange: (m: Module) => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<'slides' | 'quiz'>('slides');
  const inputClass =
    'w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500';

  function updateSlide(i: number, s: Slide) {
    const slides = [...mod.slides];
    slides[i] = s;
    onChange({ ...mod, slides });
  }

  function removeSlide(i: number) {
    onChange({ ...mod, slides: mod.slides.filter((_, j) => j !== i) });
  }

  function addSlide() {
    onChange({ ...mod, slides: [...mod.slides, { title: '', content: [] }] });
  }

  function moveSlide(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= mod.slides.length) return;
    const s = [...mod.slides];
    [s[from], s[to]] = [s[to], s[from]];
    onChange({ ...mod, slides: s });
  }

  return (
    <div className="space-y-6">
      {/* Module Metadata */}
      <div className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Module Settings</h3>
          <ConfirmButton
            onConfirm={onDelete}
            label="Delete Module"
            className="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              className={inputClass}
              value={mod.title}
              onChange={(e) => onChange({ ...mod, title: e.target.value })}
              placeholder="Module title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
            <select
              className={inputClass}
              value={mod.icon}
              onChange={(e) => onChange({ ...mod, icon: e.target.value })}
            >
              {MODULE_ICONS.map((ic) => (
                <option key={ic} value={ic}>{ic}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            className={inputClass}
            rows={2}
            value={mod.description}
            onChange={(e) => onChange({ ...mod, description: e.target.value })}
            placeholder="Short description of this module..."
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-[#0a0a0a] p-1 w-fit">
        {(['slides', 'quiz'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-white text-gray-900 shadow-sm dark:bg-[#111] dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t} ({t === 'slides' ? mod.slides.length : mod.quiz.length})
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'slides' && (
        <div className="space-y-3 pl-6">
          {mod.slides.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No slides yet. Add your first slide below.</p>
          )}
          {mod.slides.map((slide, si) => (
            <div key={si} className="relative">
              <div className="absolute -left-6 top-3 flex flex-col gap-0.5">
                {si > 0 && (
                  <button onClick={() => moveSlide(si, -1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Move up">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                )}
                {si < mod.slides.length - 1 && (
                  <button onClick={() => moveSlide(si, 1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Move down">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                )}
              </div>
              <SlideEditor
                slide={slide}
                index={si}
                onChange={(s) => updateSlide(si, s)}
                onRemove={() => removeSlide(si)}
              />
            </div>
          ))}
          <button
            onClick={addSlide}
            className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Slide
          </button>
        </div>
      )}

      {tab === 'quiz' && (
        <QuizEditor
          questions={mod.quiz}
          onChange={(q) => onChange({ ...mod, quiz: q })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Course Modal
// ---------------------------------------------------------------------------

function CreateCourseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ slug: '', title: '', description: '', target_roles: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    'w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500';

  function toggleRole(role: string) {
    setForm((prev) => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter((r) => r !== role)
        : [...prev.target_roles, role],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slug || !form.title) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/training/courses', {
        slug: form.slug,
        title: form.title,
        description: form.description,
        target_roles: form.target_roles,
        is_published: false,
        content: [],
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create course');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl bg-white dark:bg-[#0a0a0a] p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create New Course</h2>

        {error && <p className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug *</label>
          <input
            className={inputClass}
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            placeholder="e.g. sales-onboarding"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Course title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            className={inputClass}
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief course description..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Roles</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleRole(r.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  form.target_roles.includes(r.value)
                    ? 'bg-neutral-900 text-white border-neutral-700'
                    : 'bg-white dark:bg-[#111] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#262626] hover:border-neutral-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 dark:border-[#262626] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.slug || !form.title}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course List View
// ---------------------------------------------------------------------------

function CourseListView({
  courses,
  loading,
  onEdit,
  onPreview,
  onRefresh,
}: {
  courses: Course[];
  loading: boolean;
  onEdit: (slug: string) => void;
  onPreview: (slug: string) => void;
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [importing, setImporting] = useState(false);

  async function togglePublished(course: Course) {
    try {
      await api.patch(`/training/courses/${course.id}`, { is_published: !course.is_published });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(course: Course) {
    try {
      await api.delete(`/training/courses/${course.id}`);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  }

  async function importDefault() {
    setImporting(true);
    try {
      await api.post('/training/courses', {
        slug: VA_TRAINING_COURSE.id,
        title: VA_TRAINING_COURSE.title,
        description: VA_TRAINING_COURSE.description,
        target_roles: ['va', 'closer'],
        is_published: true,
        content: VA_TRAINING_COURSE.modules,
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Course Manager</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Create and manage interactive training courses</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-[#262626] p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">No courses yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating a new course or importing the default template.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Create New Course
            </button>
            <button
              onClick={importDefault}
              disabled={importing}
              className="rounded-lg border border-gray-300 dark:border-[#262626] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Import Default Course'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{course.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    course.is_published
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-[#111] dark:text-gray-400'
                  }`}
                >
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{course.description || 'No description'}</p>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 dark:bg-[#111] px-2 py-0.5 text-xs font-medium text-neutral-800 dark:text-neutral-300">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
                  </svg>
                  {course.module_count ?? course.content?.length ?? 0} modules
                </span>
                {course.target_roles?.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-gray-100 dark:bg-[#111] px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300"
                  >
                    {r.toUpperCase()}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-4 flex items-center gap-2 border-t border-gray-100 dark:border-[#1a1a1a]">
                <button
                  onClick={() => onEdit(course.slug)}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
                >
                  Edit
                </button>
                <button
                  onClick={() => onPreview(course.slug)}
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-white hover:bg-neutral-50 dark:hover:bg-[#111]"
                >
                  Preview
                </button>
                <button
                  onClick={() => togglePublished(course)}
                  className="rounded-lg border border-gray-300 dark:border-[#262626] px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111]"
                >
                  {course.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <ConfirmButton
                  onConfirm={() => handleDelete(course)}
                  label="Delete"
                  className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCourseModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Editor View
// ---------------------------------------------------------------------------

function CourseEditorView({
  courseSlug,
  onBack,
  onPreview,
}: {
  courseSlug: string;
  onBack: () => void;
  onPreview: (slug: string) => void;
}) {
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [courseMeta, setCourseMeta] = useState({ title: '', description: '', slug: '', target_roles: [] as string[], is_published: false });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loadCourse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ course: Course }>(`/training/courses/${courseSlug}`);
      setCourse(res.course);
      const content = res.course.content || [];
      setModules(content);
      setCourseMeta({
        title: res.course.title,
        description: res.course.description,
        slug: res.course.slug,
        target_roles: res.course.target_roles || [],
        is_published: res.course.is_published,
      });
      if (content.length > 0 && !selectedModuleId) {
        setSelectedModuleId(content[0].id);
      }
      setDirty(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [courseSlug, selectedModuleId]);

  useEffect(() => { loadCourse(); }, [loadCourse]);

  function updateModule(id: string, updated: Module) {
    setModules((prev) => prev.map((m) => (m.id === id ? updated : m)));
    setDirty(true);
  }

  function deleteModule(id: string) {
    setModules((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (selectedModuleId === id) {
        setSelectedModuleId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
    setDirty(true);
  }

  function addModule() {
    const id = genId();
    const newMod: Module = {
      id,
      title: 'New Module',
      description: '',
      icon: 'BookOpen',
      slides: [],
      quiz: [],
    };
    setModules((prev) => [...prev, newMod]);
    setSelectedModuleId(id);
    setDirty(true);
  }

  function moveModule(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= modules.length) return;
    setModules((prev) => {
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (!course) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.patch(`/training/courses/${course.id}`, {
        title: courseMeta.title,
        description: courseMeta.description,
        slug: courseMeta.slug,
        target_roles: courseMeta.target_roles,
        is_published: courseMeta.is_published,
        content: modules,
      });
      setDirty(false);
      setSaveMsg('Saved successfully');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const selectedModule = modules.find((m) => m.id === selectedModuleId) || null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Course not found.</p>
        <button onClick={onBack} className="mt-4 text-sm font-medium text-neutral-700 hover:text-neutral-800">Back to Courses</button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-72 shrink-0 border-r border-gray-200 dark:border-[#1a1a1a] bg-gray-50 dark:bg-black flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-[#1a1a1a]">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-800 mb-3"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Courses
          </button>

          {editingTitle ? (
            <input
              autoFocus
              className="w-full rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#111] px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100"
              value={courseMeta.title}
              onChange={(e) => { setCourseMeta({ ...courseMeta, title: e.target.value }); setDirty(true); }}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false); }}
            />
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{courseMeta.title}</h2>
              <button onClick={() => setEditingTitle(true)} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Edit title">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {modules.map((mod, i) => (
            <div
              key={mod.id}
              className={`group flex items-center gap-1 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                selectedModuleId === mod.id
                  ? 'bg-neutral-900 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111]'
              }`}
            >
              <button
                className="flex-1 text-left truncate"
                onClick={() => setSelectedModuleId(mod.id)}
              >
                {mod.title || '(untitled)'}
              </button>

              <div className={`flex items-center gap-0.5 shrink-0 ${
                selectedModuleId === mod.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                {i > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); moveModule(i, -1); }}
                    className={`p-0.5 rounded ${selectedModuleId === mod.id ? 'hover:bg-black' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    title="Move up"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                )}
                {i < modules.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); moveModule(i, 1); }}
                    className={`p-0.5 rounded ${selectedModuleId === mod.id ? 'hover:bg-black' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    title="Move down"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-[#1a1a1a]">
          <button
            onClick={addModule}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-[#262626] px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-neutral-400 hover:text-neutral-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Module
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] px-6 py-3">
          <div className="flex items-center gap-3">
            {dirty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            )}
            {saveMsg && (
              <span className={`text-xs font-medium ${saveMsg.includes('fail') || saveMsg.includes('Failed') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {saveMsg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPreview(courseSlug)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-[#262626] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Preview
            </button>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedModule ? (
            <ModuleEditor
              key={selectedModule.id}
              module={selectedModule}
              onChange={(m) => updateModule(selectedModule.id, m)}
              onDelete={() => deleteModule(selectedModule.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {modules.length === 0
                    ? 'Add a module to get started.'
                    : 'Select a module from the sidebar to edit it.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function AdminCourseManager() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ courses: Course[] }>('/training/courses');
      setCourses(res.courses);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const handlePreview = (slug: string) => navigate(`/admin/courses/preview/${slug}`);

  if (editingSlug) {
    return (
      <CourseEditorView
        courseSlug={editingSlug}
        onBack={() => { setEditingSlug(null); loadCourses(); }}
        onPreview={handlePreview}
      />
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <CourseListView
        courses={courses}
        loading={loading}
        onEdit={(slug) => setEditingSlug(slug)}
        onPreview={handlePreview}
        onRefresh={loadCourses}
      />
    </div>
  );
}

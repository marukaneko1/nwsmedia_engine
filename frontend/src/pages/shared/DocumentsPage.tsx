import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../utils/api';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ContentSection {
  id: string;
  type: 'heading' | 'paragraph' | 'list' | 'signature_block' | 'divider';
  text?: string;
  items?: string[];
  level?: number;
}

interface DocumentContent {
  sections: ContentSection[];
}

interface Document {
  id: string;
  title: string;
  type: 'contract' | 'proposal' | 'agreement' | 'nda' | 'custom';
  status: 'draft' | 'sent' | 'viewed' | 'partially_signed' | 'completed' | 'declined' | 'expired' | 'voided';
  content: DocumentContent;
  client_name: string | null;
  client_email: string | null;
  deal_id: string | null;
  expires_at: string | null;
  completed_at: string | null;
  created_by_name: string;
  signer_count: string;
  signed_count: string;
  created_at: string;
  updated_at: string;
}

interface Signer {
  id: string;
  name: string;
  email: string;
  role: string;
  order_num: number;
  status: string;
  signed_at: string | null;
  viewed_at: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  actor_name: string;
  actor_email: string;
  ip_address: string;
  details: string;
  created_at: string;
}

interface SigningLink {
  name: string;
  email: string;
  signing_url: string;
}

interface DocumentDetail {
  document: Document;
  signers: Signer[];
  fields: unknown[];
  audit: AuditEntry[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  draft:             { label: 'Draft',            classes: 'bg-gray-100 text-gray-700 dark:bg-[#111] dark:text-gray-300' },
  sent:              { label: 'Sent',             classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  viewed:            { label: 'Viewed',           classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  partially_signed:  { label: 'Partially Signed', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  completed:         { label: 'Completed',        classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  declined:          { label: 'Declined',         classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  expired:           { label: 'Expired',          classes: 'bg-gray-100 text-gray-600 dark:bg-[#111] dark:text-gray-400' },
  voided:            { label: 'Voided',           classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

const SIGNER_STATUS_VARIANT: Record<string, 'gray' | 'green' | 'yellow' | 'red' | 'blue'> = {
  pending: 'gray',
  sent: 'blue',
  viewed: 'yellow',
  signed: 'green',
  declined: 'red',
};

const TYPE_BADGE_VARIANT: Record<string, 'blue' | 'purple' | 'green' | 'red' | 'gray'> = {
  contract: 'blue',
  proposal: 'purple',
  agreement: 'green',
  nda: 'red',
  custom: 'gray',
};

const TYPE_OPTIONS = [
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'nda', label: 'NDA' },
  { value: 'custom', label: 'Custom' },
];

const ROLE_OPTIONS = [
  { value: 'signer', label: 'Signer' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'approver', label: 'Approver' },
];

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
];

const SECTION_TYPES: { type: ContentSection['type']; label: string; icon: string }[] = [
  { type: 'heading', label: 'Heading', icon: 'H' },
  { type: 'paragraph', label: 'Paragraph', icon: '¶' },
  { type: 'list', label: 'Bullet List', icon: '•' },
  { type: 'signature_block', label: 'Signature', icon: '✍' },
  { type: 'divider', label: 'Divider', icon: '—' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function uid(): string {
  return Math.random().toString(36).substring(2, 11);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function humanAction(action: string): string {
  const map: Record<string, string> = {
    document_created: 'Created document',
    document_updated: 'Updated document',
    document_sent: 'Sent for signature',
    document_viewed: 'Viewed document',
    document_signed: 'Signed document',
    document_completed: 'All signatures collected',
    document_declined: 'Declined to sign',
    document_voided: 'Voided document',
    document_expired: 'Document expired',
    signer_added: 'Added signer',
    signer_removed: 'Removed signer',
  };
  return map[action] || action.replace(/_/g, ' ');
}

function makeNewSection(type: ContentSection['type']): ContentSection {
  const base = { id: uid(), type };
  switch (type) {
    case 'heading':         return { ...base, text: 'New Heading', level: 2 };
    case 'paragraph':       return { ...base, text: 'Enter text here...' };
    case 'list':            return { ...base, items: ['Item 1', 'Item 2'] };
    case 'signature_block': return { ...base, text: 'Signer Name' };
    case 'divider':         return base;
  }
}

/* ------------------------------------------------------------------ */
/*  Small UI pieces                                                    */
/* ------------------------------------------------------------------ */

function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600 dark:border-[#1a1a1a] dark:border-t-brand-400" />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg className="h-12 w-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <p className="text-sm text-red-600 dark:text-red-400 mb-3">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.classes}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {cfg.label}
    </span>
  );
}

function DocTypeBadge({ type }: { type: string }) {
  const v = TYPE_BADGE_VARIANT[type] || 'gray';
  return <Badge variant={v}>{type.toUpperCase()}</Badge>;
}

/* ------------------------------------------------------------------ */
/*  Icons (inline SVGs to avoid deps)                                  */
/* ------------------------------------------------------------------ */

function IconArrowUp() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg className="h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Editor                                                     */
/* ------------------------------------------------------------------ */

interface SectionEditorProps {
  section: ContentSection;
  onChange: (updated: ContentSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  readOnly: boolean;
}

function SectionEditor({ section, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, readOnly }: SectionEditorProps) {
  const sectionLabel =
    section.type === 'heading' ? 'Heading' :
    section.type === 'paragraph' ? 'Paragraph' :
    section.type === 'list' ? 'Bullet List' :
    section.type === 'signature_block' ? 'Signature Block' : 'Divider';

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => {
    autoResize(textareaRef.current);
  }, [section.text, section.items, autoResize]);

  return (
    <div className="group relative rounded-lg border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] transition-shadow hover:shadow-md">
      {/* toolbar */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1a1a1a] px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {sectionLabel}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <button onClick={onMoveUp} disabled={isFirst}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-[#111] dark:hover:text-gray-300 transition-colors">
              <IconArrowUp />
            </button>
            <button onClick={onMoveDown} disabled={isLast}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-[#111] dark:hover:text-gray-300 transition-colors">
              <IconArrowDown />
            </button>
            <button onClick={onDelete}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors ml-1">
              <IconTrash />
            </button>
          </div>
        )}
      </div>

      {/* body */}
      <div className="p-3">
        {section.type === 'heading' && (
          <div className="space-y-2">
            <select
              value={section.level ?? 1}
              disabled={readOnly}
              onChange={e => onChange({ ...section, level: Number(e.target.value) })}
              className="text-xs rounded border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#111] px-2 py-1 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            >
              <option value={1}>H1 – Title</option>
              <option value={2}>H2 – Section</option>
              <option value={3}>H3 – Subsection</option>
            </select>
            <textarea
              ref={textareaRef}
              value={section.text ?? ''}
              readOnly={readOnly}
              onChange={e => { onChange({ ...section, text: e.target.value }); autoResize(e.target); }}
              rows={1}
              className={`w-full resize-none bg-transparent font-bold focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-300 ${
                (section.level ?? 1) === 1 ? 'text-xl' : (section.level ?? 1) === 2 ? 'text-lg' : 'text-base'
              }`}
              placeholder="Heading text..."
            />
          </div>
        )}

        {section.type === 'paragraph' && (
          <textarea
            ref={textareaRef}
            value={section.text ?? ''}
            readOnly={readOnly}
            onChange={e => { onChange({ ...section, text: e.target.value }); autoResize(e.target); }}
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-gray-700 dark:text-gray-300 focus:outline-none placeholder-gray-300"
            placeholder="Paragraph text..."
          />
        )}

        {section.type === 'list' && (
          <div className="space-y-1">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">One item per line</p>
            <textarea
              ref={textareaRef}
              value={(section.items ?? []).join('\n')}
              readOnly={readOnly}
              onChange={e => { onChange({ ...section, items: e.target.value.split('\n') }); autoResize(e.target); }}
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-gray-700 dark:text-gray-300 focus:outline-none font-mono placeholder-gray-300"
              placeholder="Item 1&#10;Item 2&#10;Item 3"
            />
          </div>
        )}

        {section.type === 'signature_block' && (
          <div className="space-y-3">
            <input
              value={section.text ?? ''}
              readOnly={readOnly}
              onChange={e => onChange({ ...section, text: e.target.value })}
              className="w-full bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none placeholder-gray-300 border-b border-dashed border-gray-300 dark:border-[#262626] pb-1"
              placeholder="Signer name or role..."
            />
            <div className="flex items-end gap-6 pt-2">
              <div className="flex-1">
                <div className="h-px bg-gray-300 dark:bg-gray-600 mb-1" />
                <p className="text-[11px] text-gray-400">Signature</p>
              </div>
              <div className="w-32">
                <div className="h-px bg-gray-300 dark:bg-gray-600 mb-1" />
                <p className="text-[11px] text-gray-400">Date</p>
              </div>
            </div>
          </div>
        )}

        {section.type === 'divider' && (
          <div className="py-2">
            <hr className="border-gray-300 dark:border-[#262626]" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Section Bar                                                    */
/* ------------------------------------------------------------------ */

function AddSectionBar({ onAdd }: { onAdd: (type: ContentSection['type']) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 dark:border-[#1a1a1a] p-3">
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 mr-1">Add section:</span>
      {SECTION_TYPES.map(s => (
        <button
          key={s.type}
          onClick={() => onAdd(s.type)}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-brand-400 hover:text-neutral-800 dark:hover:border-neutral-500 dark:hover:text-brand-400 transition-colors"
        >
          <span className="text-sm leading-none">{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Signers Panel                                                      */
/* ------------------------------------------------------------------ */

function SignersPanel({ documentId, signers, readOnly, onUpdate }: {
  documentId: string;
  signers: Signer[];
  readOnly: boolean;
  onUpdate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('signer');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      await api.post(`/documents/${documentId}/signers`, {
        name: name.trim(), email: email.trim(), role, order_num: signers.length + 1,
      });
      setName(''); setEmail(''); setRole('signer'); setAdding(false);
      onUpdate();
    } catch { /* error handled silently */ } finally { setSaving(false); }
  };

  const handleRemove = async (signerId: string) => {
    setRemovingId(signerId);
    try {
      await api.delete(`/documents/${documentId}/signers/${signerId}`);
      onUpdate();
    } catch { /* error handled silently */ } finally { setRemovingId(null); }
  };

  return (
    <div className="space-y-3">
      {signers.length === 0 && !adding && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No signers added yet</p>
      )}

      {signers.map(s => (
        <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-[#111] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</p>
              <Badge variant={SIGNER_STATUS_VARIANT[s.status] || 'gray'}>
                {s.status}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.email}</p>
            {s.signed_at && (
              <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                Signed {formatDateTime(s.signed_at)}
              </p>
            )}
          </div>
          {!readOnly && (
            <button
              onClick={() => handleRemove(s.id)}
              disabled={removingId === s.id}
              className="ml-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors disabled:opacity-40"
            >
              {removingId === s.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
              ) : (
                <IconTrash />
              )}
            </button>
          )}
        </div>
      ))}

      {!readOnly && !adding && (
        <button onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-[#262626] py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-neutral-800 dark:hover:border-neutral-500 dark:hover:text-brand-400 transition-colors">
          <IconPlus /> Add Signer
        </button>
      )}

      {adding && (
        <div className="space-y-2 rounded-lg border border-neutral-200 dark:border-brand-800 bg-neutral-50/50 dark:bg-[#111] p-3">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
          <Select label="Role" value={role} onChange={e => setRole(e.target.value)} options={ROLE_OPTIONS} />
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} disabled={saving || !name.trim() || !email.trim()}>
              {saving ? 'Adding...' : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setName(''); setEmail(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Signing Links Modal                                                */
/* ------------------------------------------------------------------ */

function SigningLinksModal({ open, onClose, links }: { open: boolean; onClose: () => void; links: SigningLink[] }) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleCopy = async (url: string, email: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch { /* clipboard not available */ }
  };

  return (
    <Modal open={open} onClose={onClose} title="Signing Links" size="lg">
      <div className="space-y-2">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Share these unique links with each signer. Each link is personalized and tracks their signing status.
        </p>
        {links.map(link => (
          <div key={link.email}
            className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-[#111] p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{link.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{link.email}</p>
              <p className="text-xs text-neutral-700 dark:text-white truncate mt-1 font-mono">{link.signing_url}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => handleCopy(link.signing_url, link.email)}>
              {copiedEmail === link.email ? (
                <span className="text-green-600 dark:text-green-400">Copied!</span>
              ) : (
                <span className="inline-flex items-center gap-1"><IconCopy /> Copy</span>
              )}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Audit Timeline                                                     */
/* ------------------------------------------------------------------ */

function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
          {idx < entries.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200 dark:bg-[#111]" />
          )}
          <div className="relative z-10 mt-1 h-[22px] w-[22px] flex-shrink-0 rounded-full border-2 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0a0a0a] flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-neutral-800" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {humanAction(entry.action)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {entry.actor_name}{entry.actor_email ? ` (${entry.actor_email})` : ''} · {formatDateTime(entry.created_at)}
            </p>
            {entry.details && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{entry.details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Document Preview (paper render)                                    */
/* ------------------------------------------------------------------ */

function DocumentPreview({ content, title, type, clientName, signers }: {
  content: DocumentContent;
  title: string;
  type: string;
  clientName: string | null;
  signers: Signer[];
}) {
  const signerMap = new Map(signers.map(s => [s.name.toLowerCase(), s]));

  return (
    <div className="mx-auto max-w-[800px] bg-white shadow-xl rounded-sm border border-gray-200">
      <div className="px-16 py-14" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
        {/* Letterhead */}
        <div className="text-center mb-10 pb-6 border-b-2 border-gray-800">
          <img src="/logo.jpeg" alt="NWS Media" className="mx-auto h-16 rounded-lg object-contain mb-2" />
          <p className="text-[10px] text-gray-400 mt-1 tracking-[0.25em] uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
            Digital Marketing & Media Solutions
          </p>
        </div>

        {/* Document title & meta */}
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider" style={{ fontFamily: "'Inter', sans-serif" }}>
            {type} {clientName ? `· ${clientName}` : ''}
          </p>
        </div>

        {/* Sections */}
        {content.sections.map(section => {
          switch (section.type) {
            case 'heading': {
              const Tag = (section.level ?? 1) === 1 ? 'h2' : (section.level ?? 1) === 2 ? 'h3' : 'h4';
              const size = (section.level ?? 1) === 1 ? 'text-lg' : (section.level ?? 1) === 2 ? 'text-base' : 'text-sm';
              return (
                <Tag key={section.id} className={`${size} font-bold text-gray-900 mt-6 mb-2`}>
                  {section.text}
                </Tag>
              );
            }
            case 'paragraph':
              return (
                <p key={section.id} className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">
                  {section.text}
                </p>
              );
            case 'list':
              return (
                <ul key={section.id} className="list-disc list-inside text-sm text-gray-700 leading-relaxed mb-4 space-y-1 ml-2">
                  {(section.items ?? []).filter(Boolean).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              );
            case 'signature_block': {
              const signer = signerMap.get((section.text ?? '').toLowerCase());
              const isSigned = signer?.status === 'signed';
              return (
                <div key={section.id} className="mt-10 mb-6 pt-4">
                  <div className="flex items-end gap-8">
                    <div className="flex-1">
                      {isSigned ? (
                        <div className="mb-1 px-2 py-1">
                          <span className="text-green-700 font-semibold italic text-sm" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}>
                            ✓ Signed electronically
                          </span>
                          {signer?.signed_at && (
                            <span className="text-[10px] text-green-600 ml-2">
                              {formatDateTime(signer.signed_at)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-8" />
                      )}
                      <div className="border-b border-gray-900 mb-1" />
                      <p className="text-xs text-gray-600">{section.text || 'Signature'}</p>
                    </div>
                    <div className="w-36">
                      {isSigned && signer?.signed_at ? (
                        <p className="text-sm text-gray-700 mb-1">{formatDate(signer.signed_at)}</p>
                      ) : (
                        <div className="h-8" />
                      )}
                      <div className="border-b border-gray-900 mb-1" />
                      <p className="text-xs text-gray-600">Date</p>
                    </div>
                  </div>
                </div>
              );
            }
            case 'divider':
              return <hr key={section.id} className="my-6 border-gray-300" />;
            default:
              return null;
          }
        })}

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-gray-200 text-center">
          <p className="text-[10px] text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
            This document was generated by NWS Media Document Platform. All signatures are legally binding electronic signatures.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Document Editor / Detail View                                      */
/* ------------------------------------------------------------------ */

function DocumentEditor({ documentId, onBack }: { documentId: string; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [showAudit, setShowAudit] = useState(false);

  const [settings, setSettings] = useState({
    title: '', type: 'contract' as Document['type'],
    client_name: '', client_email: '', expires_at: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [signingLinks, setSigningLinks] = useState<SigningLink[]>([]);
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const isDraft = doc?.status === 'draft';
  const canEdit = isDraft;
  const canSend = isDraft && signers.length > 0;
  const canVoid = doc?.status === 'sent' || doc?.status === 'viewed' || doc?.status === 'partially_signed';

  const loadDocument = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.get<DocumentDetail>(`/documents/${documentId}`);
      setDoc(data.document);
      setSections(data.document.content?.sections ?? []);
      setSigners(data.signers ?? []);
      setAudit(data.audit ?? []);
      setSettings({
        title: data.document.title,
        type: data.document.type,
        client_name: data.document.client_name ?? '',
        client_email: data.document.client_email ?? '',
        expires_at: data.document.expires_at ? data.document.expires_at.split('T')[0] : '',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally { setLoading(false); }
  }, [documentId]);

  useEffect(() => { loadDocument(); }, [loadDocument]);

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      await api.patch(`/documents/${documentId}`, {
        title: settings.title,
        type: settings.type,
        content: { sections },
        client_name: settings.client_name || null,
        client_email: settings.client_email || null,
        expires_at: settings.expires_at || null,
      });
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(null), 2000);
      loadDocument();
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await api.post<{ success: boolean; links: SigningLink[] }>(`/documents/${documentId}/send`);
      setSigningLinks(result.links ?? []);
      setShowLinksModal(true);
      loadDocument();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally { setSending(false); }
  };

  const handleVoid = async () => {
    setVoiding(true);
    try {
      await api.patch(`/documents/${documentId}`, { status: 'voided' });
      setShowVoidConfirm(false);
      loadDocument();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to void');
    } finally { setVoiding(false); }
  };

  const updateSection = (idx: number, updated: ContentSection) => {
    setSections(prev => prev.map((s, i) => i === idx ? updated : s));
  };

  const deleteSection = (idx: number) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
  };

  const moveSection = (idx: number, direction: -1 | 1) => {
    setSections(prev => {
      const arr = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const addSection = (type: ContentSection['type']) => {
    setSections(prev => [...prev, makeNewSection(type)]);
  };

  if (loading) return <Spinner />;
  if (error && !doc) return <ErrorBanner message={error} onRetry={loadDocument} />;
  if (!doc) return <ErrorBanner message="Document not found" />;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          <IconBack /> Back to Documents
        </button>
        <div className="flex items-center gap-2">
          <DocStatusBadge status={doc.status} />
          {canSend && (
            <Button onClick={handleSend} disabled={sending} size="sm">
              <IconSend />
              {sending ? 'Sending...' : 'Send for Signature'}
            </Button>
          )}
          {canVoid && (
            <Button variant="danger" size="sm" onClick={() => setShowVoidConfirm(true)}>
              Void Document
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Main layout: builder + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Content builder */}
        <div className="lg:col-span-2 space-y-4">
          {/* Edit / Preview tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-[#0a0a0a] p-1 w-fit">
            {(['edit', 'preview'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t === 'edit' ? 'Edit' : 'Preview'}
              </button>
            ))}
          </div>

          {tab === 'edit' ? (
            <div className="space-y-3">
              {sections.length === 0 && (
                <div className="text-center py-10">
                  <IconDocument />
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">No sections yet. Add one below.</p>
                </div>
              )}

              {sections.map((section, idx) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  onChange={updated => updateSection(idx, updated)}
                  onDelete={() => deleteSection(idx)}
                  onMoveUp={() => moveSection(idx, -1)}
                  onMoveDown={() => moveSection(idx, 1)}
                  isFirst={idx === 0}
                  isLast={idx === sections.length - 1}
                  readOnly={!canEdit}
                />
              ))}

              {canEdit && <AddSectionBar onAdd={addSection} />}
            </div>
          ) : (
            <DocumentPreview
              content={{ sections }}
              title={settings.title}
              type={settings.type}
              clientName={settings.client_name || null}
              signers={signers}
            />
          )}
        </div>

        {/* Right: Settings + Signers */}
        <div className="space-y-6">
          {/* Settings Card */}
          <Card title="Document Settings">
            <div className="space-y-4">
              <Input
                label="Title"
                value={settings.title}
                readOnly={!canEdit}
                onChange={e => setSettings(s => ({ ...s, title: e.target.value }))}
                placeholder="Document title"
              />
              <Select
                label="Type"
                value={settings.type}
                disabled={!canEdit}
                onChange={e => setSettings(s => ({ ...s, type: e.target.value as Document['type'] }))}
                options={TYPE_OPTIONS}
              />
              <Input
                label="Client Name"
                value={settings.client_name}
                readOnly={!canEdit}
                onChange={e => setSettings(s => ({ ...s, client_name: e.target.value }))}
                placeholder="Jane Smith"
              />
              <Input
                label="Client Email"
                type="email"
                value={settings.client_email}
                readOnly={!canEdit}
                onChange={e => setSettings(s => ({ ...s, client_email: e.target.value }))}
                placeholder="jane@example.com"
              />
              <Input
                label="Expires On"
                type="date"
                value={settings.expires_at}
                readOnly={!canEdit}
                onChange={e => setSettings(s => ({ ...s, expires_at: e.target.value }))}
              />
              {canEdit && (
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? 'Saving...' : 'Save Document'}
                  </Button>
                  {saveMsg && (
                    <span className={`text-xs font-medium ${
                      saveMsg === 'Saved!' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {saveMsg}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Signers Card */}
          <Card title="Signers" action={
            signers.length > 0 ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {signers.filter(s => s.status === 'signed').length}/{signers.length} signed
              </span>
            ) : undefined
          }>
            <SignersPanel
              documentId={documentId}
              signers={signers}
              readOnly={!canEdit}
              onUpdate={loadDocument}
            />
          </Card>

          {/* Document info */}
          {!isDraft && (
            <Card title="Details">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Created by</dt>
                  <dd className="text-gray-900 dark:text-gray-100 font-medium">{doc.created_by_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(doc.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Last updated</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(doc.updated_at)}</dd>
                </div>
                {doc.completed_at && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Completed</dt>
                    <dd className="text-green-600 dark:text-green-400 font-medium">{formatDate(doc.completed_at)}</dd>
                  </div>
                )}
                {doc.expires_at && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Expires</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{formatDate(doc.expires_at)}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>

      {/* Audit log (for non-draft documents) */}
      {!isDraft && audit.length > 0 && (
        <Card>
          <button
            onClick={() => setShowAudit(v => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity Log</h3>
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform ${showAudit ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showAudit && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#1a1a1a]">
              <AuditTimeline entries={audit} />
            </div>
          )}
        </Card>
      )}

      {/* Void confirmation */}
      <Modal open={showVoidConfirm} onClose={() => setShowVoidConfirm(false)} title="Void Document">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to void this document? This will cancel all pending signatures and the document will no longer be valid.
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowVoidConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleVoid} disabled={voiding}>
            {voiding ? 'Voiding...' : 'Void Document'}
          </Button>
        </div>
      </Modal>

      {/* Signing links modal */}
      <SigningLinksModal open={showLinksModal} onClose={() => setShowLinksModal(false)} links={signingLinks} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Document List View                                                 */
/* ------------------------------------------------------------------ */

function DocumentList({ onSelect, onNew }: { onSelect: (id: string) => void; onNew: () => void }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { data, loading, error, refetch } = useApiQuery<{ documents: Document[] }>('/documents');
  const documents = data?.documents ?? [];

  const filtered = documents.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.title.toLowerCase().includes(q) ||
             (d.client_name ?? '').toLowerCase().includes(q) ||
             d.type.includes(q);
    }
    return true;
  });

  const counts = {
    all: documents.length,
    draft: documents.filter(d => d.status === 'draft').length,
    sent: documents.filter(d => d.status === 'sent' || d.status === 'viewed' || d.status === 'partially_signed').length,
    completed: documents.filter(d => d.status === 'completed').length,
    declined: documents.filter(d => d.status === 'declined').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Documents</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create, manage, and track document signatures
          </p>
        </div>
        <Button onClick={onNew}>
          <IconPlus /> <span className="ml-1.5">New Document</span>
        </Button>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-gray-100 dark:bg-[#0a0a0a] p-1">
          {FILTER_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                filter === t.key
                  ? 'bg-white dark:bg-[#111] text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                {counts[t.key as keyof typeof counts] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-64 rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <IconDocument />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mt-4">
            {search || filter !== 'all' ? 'No documents match your filters' : 'No documents yet'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            {search || filter !== 'all'
              ? 'Try adjusting your search or filter to find what you\'re looking for.'
              : 'Create your first document to start collecting signatures.'}
          </p>
          {!search && filter === 'all' && (
            <Button onClick={onNew} className="mt-6">
              <IconPlus /> <span className="ml-1.5">Create Your First Document</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => (
            <button
              key={doc.id}
              onClick={() => onSelect(doc.id)}
              className="w-full text-left rounded-xl border border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-4 shadow-sm hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-all group"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* Icon */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-50 dark:bg-[#111] text-neutral-700 dark:text-white group-hover:bg-neutral-100 dark:group-hover:bg-brand-900/30 transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>

                {/* Title + client */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-neutral-800 dark:group-hover:text-brand-400 transition-colors">
                    {doc.title}
                  </p>
                  {doc.client_name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{doc.client_name}</p>
                  )}
                </div>

                {/* Type badge */}
                <DocTypeBadge type={doc.type} />

                {/* Status badge */}
                <DocStatusBadge status={doc.status} />

                {/* Signer progress */}
                {Number(doc.signer_count) > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-[#111]">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${(Number(doc.signed_count) / Number(doc.signer_count)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {doc.signed_count}/{doc.signer_count} signed
                    </span>
                  </div>
                )}

                {/* Date */}
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatDate(doc.updated_at)}
                </span>

                {/* Arrow */}
                <svg className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Exported Page                                                 */
/* ------------------------------------------------------------------ */

export function DocumentsPage() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setView('editor');
  };

  const handleBack = () => {
    setView('list');
    setSelectedId(null);
  };

  const handleNew = async () => {
    setCreating(true);
    try {
      const result = await api.post<{ document: Document }>('/documents', {
        title: 'Untitled Document',
        type: 'contract',
        content: {
          sections: [
            { id: uid(), type: 'heading', text: 'Untitled Document', level: 1 },
            { id: uid(), type: 'paragraph', text: '' },
          ],
        },
      });
      setSelectedId(result.document.id);
      setView('editor');
    } catch {
      /* creation error – user stays on list */
    } finally {
      setCreating(false);
    }
  };

  if (creating) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600 dark:border-[#1a1a1a] dark:border-t-brand-400 mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Creating document...</p>
      </div>
    );
  }

  if (view === 'editor' && selectedId) {
    return <DocumentEditor documentId={selectedId} onBack={handleBack} />;
  }

  return <DocumentList onSelect={handleSelect} onNew={handleNew} />;
}

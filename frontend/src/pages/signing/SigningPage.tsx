import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface SigningField {
  id: string;
  type: 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'name' | 'email' | 'company';
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  value: string;
}

interface SignerInfo {
  id: string;
  name: string;
  email: string;
  status: string;
  signed_at: string | null;
}

interface DocumentInfo {
  title: string;
  type: string;
  content: DocumentContent;
  sender_name: string;
}

interface SigningData {
  document: DocumentInfo;
  signer: SignerInfo;
  fields: SigningField[];
}

type PageState = 'loading' | 'error' | 'already_signed' | 'signing' | 'success';

// ─── Signature Pad Hook ─────────────────────────────────────────────────────

function useSignaturePad(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const getPoint = useCallback((e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPoint.current = getPoint(e, canvas);
  }, [canvasRef, getPoint]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing.current || !lastPoint.current) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const point = getPoint(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPoint.current = point;
  }, [canvasRef, getPoint]);

  const stopDrawing = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  const isEmpty = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return false;
    }
    return true;
  }, [canvasRef]);

  const toDataURL = useCallback(() => {
    return canvasRef.current?.toDataURL('image/png') || '';
  }, [canvasRef]);

  const attach = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => {};
    const onMouseDown = (e: MouseEvent) => startDrawing(e);
    const onMouseMove = (e: MouseEvent) => draw(e);
    const onMouseUp = () => stopDrawing();
    const onTouchStart = (e: TouchEvent) => startDrawing(e);
    const onTouchMove = (e: TouchEvent) => draw(e);
    const onTouchEnd = () => stopDrawing();

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [canvasRef, startDrawing, draw, stopDrawing]);

  return { attach, clear, isEmpty, toDataURL };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SigningPage() {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<SigningData | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signatureData, setSignatureData] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [sigModalFieldId, setSigModalFieldId] = useState<string | null>(null);
  const [sigTab, setSigTab] = useState<'draw' | 'type'>('draw');
  const [typedSig, setTypedSig] = useState('');
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigPad = useSignaturePad(sigCanvasRef);

  // ─── Fetch document on mount ────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setErrorMessage('No signing token provided.');
      setPageState('error');
      return;
    }

    fetch(`/api/documents/sign/${token}`)
      .then(async (res) => {
        if (res.status === 404) {
          setErrorMessage('Document not found');
          setPageState('error');
          return;
        }
        if (res.status === 410) {
          const body = await res.json().catch(() => ({}));
          const msg = body.error?.toLowerCase().includes('void')
            ? 'This document has been voided'
            : 'This signing link has expired';
          setErrorMessage(msg);
          setPageState('error');
          return;
        }
        if (!res.ok) {
          setErrorMessage('Something went wrong. Please try again later.');
          setPageState('error');
          return;
        }
        const result: SigningData = await res.json();
        setData(result);

        if (result.signer.status === 'signed') {
          setPageState('already_signed');
          return;
        }

        const initial: Record<string, string> = {};
        for (const f of result.fields) {
          if (f.value) {
            initial[f.id] = f.value;
          } else if (f.type === 'date') {
            initial[f.id] = new Date().toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            });
          } else if (f.type === 'name') {
            initial[f.id] = result.signer.name || '';
          } else if (f.type === 'email') {
            initial[f.id] = result.signer.email || '';
          }
        }
        setFieldValues(initial);
        setPageState('signing');
      })
      .catch(() => {
        setErrorMessage('Unable to connect. Please check your internet connection.');
        setPageState('error');
      });
  }, [token]);

  // Attach signature pad events when modal opens
  useEffect(() => {
    if (sigModalOpen && sigTab === 'draw') {
      const timer = setTimeout(() => sigPad.attach(), 50);
      return () => clearTimeout(timer);
    }
  }, [sigModalOpen, sigTab, sigPad]);

  // ─── Field helpers ──────────────────────────────────────────────────────

  const setFieldValue = (id: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  };

  const requiredFields = data?.fields.filter((f) => f.required) || [];
  const filledRequired = requiredFields.filter((f) => {
    if (f.type === 'signature' || f.type === 'initials') return !!fieldValues[f.id];
    if (f.type === 'checkbox') return fieldValues[f.id] === 'true';
    return !!fieldValues[f.id]?.trim();
  });
  const allRequiredFilled = filledRequired.length === requiredFields.length;
  const totalFields = data?.fields.length || 0;
  const completedFields = data?.fields.filter((f) => {
    if (f.type === 'signature' || f.type === 'initials') return !!fieldValues[f.id];
    if (f.type === 'checkbox') return fieldValues[f.id] === 'true';
    return !!fieldValues[f.id]?.trim();
  }).length || 0;

  // ─── Open signature modal ──────────────────────────────────────────────

  const openSignatureModal = (fieldId: string) => {
    setSigModalFieldId(fieldId);
    setSigTab('draw');
    setTypedSig('');
    setSigModalOpen(true);
  };

  const acceptSignature = () => {
    if (!sigModalFieldId) return;
    if (sigTab === 'draw') {
      if (sigPad.isEmpty()) return;
      const dataUrl = sigPad.toDataURL();
      setFieldValue(sigModalFieldId, dataUrl);
      if (!signatureData) setSignatureData(dataUrl);
    } else {
      if (!typedSig.trim()) return;
      const typed = `typed:${typedSig.trim()}`;
      setFieldValue(sigModalFieldId, typed);
      if (!signatureData) setSignatureData(typed);
    }
    setSigModalOpen(false);
    setSigModalFieldId(null);
  };

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!token || !allRequiredFilled || submitting) return;
    setSubmitting(true);
    try {
      const sigField = data?.fields.find((f) => f.type === 'signature');
      const sigData = sigField ? fieldValues[sigField.id] || signatureData : signatureData;

      const res = await fetch(`/api/documents/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_data: sigData,
          field_values: fieldValues,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Signing failed' }));
        alert(body.error || 'Failed to complete signing. Please try again.');
        setSubmitting(false);
        return;
      }
      setPageState('success');
    } catch {
      alert('Network error. Please check your connection and try again.');
    }
    setSubmitting(false);
  };

  // ─── Decline ────────────────────────────────────────────────────────────

  const handleDecline = async () => {
    if (!token || declining) return;
    setDeclining(true);
    try {
      const res = await fetch(`/api/documents/sign/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason }),
      });
      if (!res.ok) {
        alert('Failed to decline. Please try again.');
        setDeclining(false);
        return;
      }
      setDeclineModalOpen(false);
      setErrorMessage('You have declined to sign this document.');
      setPageState('error');
    } catch {
      alert('Network error. Please try again.');
    }
    setDeclining(false);
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────

  if (pageState === 'loading') return <LoadingScreen />;
  if (pageState === 'error') return <ErrorScreen message={errorMessage} />;
  if (pageState === 'already_signed' && data) return <AlreadySignedScreen data={data} />;
  if (pageState === 'success' && data) return <SuccessScreen data={data} />;
  if (!data) return <ErrorScreen message="Something went wrong." />;

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="NWS Media" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-sm font-semibold text-gray-800">
              NWS Media
              <span className="ml-1.5 font-normal text-gray-400">|</span>
              <span className="ml-1.5 font-normal text-gray-500">Document Signing</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <LockIcon />
            <span>Secure Signing</span>
          </div>
        </div>
      </header>

      {/* ─── Info bar ────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <DocumentIcon />
            <span className="text-sm font-medium text-gray-900">{data.document.title}</span>
          </div>
          <span className="text-xs text-gray-500">
            Sent by <span className="font-medium text-gray-700">{data.document.sender_name}</span>
          </span>
        </div>
      </div>

      {/* ─── Document body ───────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-gray-200 bg-white shadow-md">
            <div className="px-8 py-10 sm:px-12 sm:py-12">
              {data.document.content.sections.map((section) => (
                <DocumentSection
                  key={section.id}
                  section={section}
                  fields={data.fields}
                  fieldValues={fieldValues}
                  onFieldChange={setFieldValue}
                  onSignatureClick={openSignatureModal}
                />
              ))}

              {/* Render any fields not associated with a signature_block section */}
              {data.fields
                .filter((f) => f.type !== 'signature' && f.type !== 'initials')
                .filter((f) => {
                  const inSection = data.document.content.sections.some(
                    (s) => s.type === 'signature_block' && s.id === f.id
                  );
                  return !inSection;
                })
                .map((field) => (
                  <InlineField
                    key={field.id}
                    field={field}
                    value={fieldValues[field.id] || ''}
                    onChange={(v) => setFieldValue(field.id, v)}
                  />
                ))}
            </div>
          </div>
        </div>
      </main>

      {/* ─── Bottom action bar ───────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-30 border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDeclineModalOpen(true)}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:border-red-300"
            >
              Decline
            </button>
            <span className="hidden text-xs text-gray-400 sm:inline">
              {completedFields} of {totalFields} field{totalFields !== 1 ? 's' : ''} completed
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile progress */}
            <span className="text-xs text-gray-400 sm:hidden">
              {completedFields}/{totalFields}
            </span>
            <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-gray-200 sm:block">
              <div
                className="h-full rounded-full bg-violet-600 transition-all duration-500"
                style={{ width: totalFields ? `${(completedFields / totalFields) * 100}%` : '0%' }}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!allRequiredFilled || submitting}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Signing...
                </span>
              ) : (
                'Sign & Complete'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Signature Modal ─────────────────────────────────────────────── */}
      {sigModalOpen && (
        <ModalBackdrop onClose={() => setSigModalOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add Your Signature</h3>
              <button
                onClick={() => setSigModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <XIcon />
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                onClick={() => setSigTab('draw')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  sigTab === 'draw'
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Draw
              </button>
              <button
                onClick={() => setSigTab('type')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  sigTab === 'type'
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Type
              </button>
            </div>

            {sigTab === 'draw' ? (
              <div>
                <div className="relative rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                  <canvas
                    ref={sigCanvasRef}
                    width={460}
                    height={180}
                    className="w-full cursor-crosshair touch-none"
                    style={{ height: 180 }}
                  />
                  <div className="pointer-events-none absolute bottom-4 left-4 right-4 border-b border-gray-300" />
                  <span className="pointer-events-none absolute bottom-6 left-4 text-[10px] text-gray-300">
                    Sign above this line
                  </span>
                </div>
                <button
                  onClick={() => sigPad.clear()}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={typedSig}
                  onChange={(e) => setTypedSig(e.target.value)}
                  placeholder="Type your full name"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
                {typedSig && (
                  <div className="mt-4 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-6">
                    <span
                      className="text-3xl text-gray-800"
                      style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
                    >
                      {typedSig}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setSigModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={acceptSignature}
                className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                Accept & Sign
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ─── Decline Modal ───────────────────────────────────────────────── */}
      {declineModalOpen && (
        <ModalBackdrop onClose={() => setDeclineModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Decline to Sign</h3>
            </div>
            <p className="mb-4 mt-2 text-sm text-gray-500">
              Are you sure you want to decline? The sender will be notified.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining (optional)"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeclineModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={declining}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
              >
                {declining ? 'Declining...' : 'Decline to Sign'}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}

// ─── Document Section Renderer ───────────────────────────────────────────────

function DocumentSection({
  section,
  fields,
  fieldValues,
  onFieldChange,
  onSignatureClick,
}: {
  section: ContentSection;
  fields: SigningField[];
  fieldValues: Record<string, string>;
  onFieldChange: (id: string, value: string) => void;
  onSignatureClick: (fieldId: string) => void;
}) {
  switch (section.type) {
    case 'heading':
      if (section.level === 1) {
        return <h1 className="mb-4 mt-6 text-2xl font-bold text-gray-900 first:mt-0">{section.text}</h1>;
      }
      if (section.level === 2) {
        return <h2 className="mb-3 mt-6 text-xl font-semibold text-gray-800">{section.text}</h2>;
      }
      return <h3 className="mb-2 mt-5 text-lg font-semibold text-gray-700">{section.text}</h3>;

    case 'paragraph':
      return <p className="mb-4 text-sm leading-relaxed text-gray-600">{section.text}</p>;

    case 'list':
      return (
        <ul className="mb-4 ml-5 list-disc space-y-1">
          {section.items?.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed text-gray-600">{item}</li>
          ))}
        </ul>
      );

    case 'divider':
      return <hr className="my-6 border-gray-200" />;

    case 'signature_block': {
      const sigFields = fields.filter(
        (f) => f.type === 'signature' || f.type === 'initials'
      );
      const blockFields = sigFields.length > 0 ? sigFields : [];
      const relatedFields = fields.filter(
        (f) => f.type !== 'signature' && f.type !== 'initials'
      );

      return (
        <div className="my-8 rounded-lg border-2 border-amber-300 bg-amber-50/50 p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-amber-700">
            {section.text || 'Signature Required'}
          </p>

          {blockFields.map((field) => {
            const value = fieldValues[field.id];
            const isSigned = !!value;
            return (
              <div key={field.id} className="mb-4">
                <button
                  onClick={() => onSignatureClick(field.id)}
                  className={`group relative flex w-full items-center justify-center rounded-lg border-2 border-dashed p-6 transition ${
                    isSigned
                      ? 'border-green-300 bg-green-50'
                      : 'border-amber-400 bg-white hover:border-violet-400 hover:bg-violet-50'
                  }`}
                >
                  {isSigned ? (
                    <SignaturePreview value={value} />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-amber-600 group-hover:text-violet-600">
                      <PenIcon />
                      <span className="text-sm font-medium">
                        {field.type === 'initials' ? 'Initial Here' : 'Sign Here'}
                      </span>
                      {field.required && (
                        <span className="text-[10px] text-amber-400 group-hover:text-violet-400">Required</span>
                      )}
                    </div>
                  )}
                </button>
                <p className="mt-1 text-xs text-gray-400">{field.label}</p>
              </div>
            );
          })}

          <div className="grid gap-3 sm:grid-cols-2">
            {relatedFields
              .filter((f) => ['name', 'date', 'email', 'company', 'text'].includes(f.type))
              .slice(0, 4)
              .map((field) => (
                <InlineField
                  key={field.id}
                  field={field}
                  value={fieldValues[field.id] || ''}
                  onChange={(v) => onFieldChange(field.id, v)}
                />
              ))}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

// ─── Inline Field ────────────────────────────────────────────────────────────

function InlineField({
  field,
  value,
  onChange,
}: {
  field: SigningField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'checkbox') {
    return (
      <label className="my-2 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : '')}
          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
        />
        <span className="text-sm text-gray-700">
          {field.label}
          {field.required && <span className="ml-1 text-red-400">*</span>}
        </span>
      </label>
    );
  }

  if (field.type === 'date') {
    return (
      <div className="my-2">
        <label className="mb-1 block text-xs font-medium text-gray-500">
          {field.label}
          {field.required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
      </div>
    );
  }

  return (
    <div className="my-2">
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {field.label}
        {field.required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        type={field.type === 'email' ? 'email' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={fieldPlaceholder(field.type)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
      />
    </div>
  );
}

function fieldPlaceholder(type: string): string {
  switch (type) {
    case 'name': return 'Full name';
    case 'email': return 'Email address';
    case 'company': return 'Company name';
    default: return 'Enter value';
  }
}

// ─── Signature Preview ───────────────────────────────────────────────────────

function SignaturePreview({ value }: { value: string }) {
  if (value.startsWith('typed:')) {
    const text = value.replace('typed:', '');
    return (
      <span
        className="text-2xl text-gray-800"
        style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
      >
        {text}
      </span>
    );
  }
  return <img src={value} alt="Signature" className="max-h-16" />;
}

// ─── Screen States ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.jpeg" alt="NWS Media" className="h-12 w-12 rounded-xl object-cover" />
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600" />
        <p className="text-sm text-gray-400">Loading document...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  const isVoid = message.toLowerCase().includes('void');
  const isExpired = message.toLowerCase().includes('expired');
  const isDeclined = message.toLowerCase().includes('declined');

  let iconBg = 'bg-red-100';
  let iconColor = 'text-red-600';
  let iconPath = 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z';

  if (isExpired) {
    iconBg = 'bg-amber-100';
    iconColor = 'text-amber-600';
    iconPath = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
  } else if (isVoid) {
    iconBg = 'bg-gray-100';
    iconColor = 'text-gray-500';
    iconPath = 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636';
  } else if (isDeclined) {
    iconBg = 'bg-orange-100';
    iconColor = 'text-orange-600';
    iconPath = 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${iconBg}`}>
          <svg className={`h-8 w-8 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">{message}</h2>
        <p className="mt-2 text-sm text-gray-500">
          {isExpired
            ? 'Please contact the sender to request a new signing link.'
            : isVoid
            ? 'This document is no longer available for signing.'
            : isDeclined
            ? 'The sender has been notified of your decision.'
            : 'If you believe this is an error, please contact the sender.'}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-300">
          <img src="/logo.jpeg" alt="NWS Media" className="h-5 w-5 rounded object-cover" />
          <span>NWS Media</span>
        </div>
      </div>
    </div>
  );
}

function AlreadySignedScreen({ data }: { data: SigningData }) {
  const signedDate = data.signer.signed_at
    ? new Date(data.signer.signed_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'a previous date';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Already Signed</h2>
        <p className="mt-2 text-sm text-gray-500">
          You signed <span className="font-medium text-gray-700">{data.document.title}</span> on {signedDate}.
        </p>
        <p className="mt-3 text-xs text-gray-400">No further action is needed.</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-300">
          <img src="/logo.jpeg" alt="NWS Media" className="h-5 w-5 rounded object-cover" />
          <span>NWS Media</span>
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({ data }: { data: SigningData }) {
  const now = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex h-20 w-20 animate-bounce-once items-center justify-center rounded-full bg-green-100">
          <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              className="animate-draw-check"
            />
          </svg>
        </div>
        <h2 className="mt-5 text-xl font-bold text-gray-900">Document Signed Successfully</h2>
        <p className="mt-2 text-sm text-gray-600">
          You signed <span className="font-medium text-gray-800">{data.document.title}</span> on {now}.
        </p>
        <div className="mt-4 rounded-lg bg-violet-50 px-4 py-3">
          <p className="text-xs text-violet-700">
            A copy will be sent to <span className="font-medium">{data.signer.email}</span>
          </p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-300">
          <img src="/logo.jpeg" alt="NWS Media" className="h-5 w-5 rounded object-cover" />
          <span>NWS Media</span>
        </div>
      </div>

      <style>{`
        @keyframes bounce-once {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes draw-check {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-bounce-once {
          animation: bounce-once 0.6s ease-out;
        }
        .animate-draw-check {
          stroke-dasharray: 40;
          animation: draw-check 0.5s ease-out 0.3s forwards;
          stroke-dashoffset: 40;
        }
      `}</style>
    </div>
  );
}

// ─── Modal Backdrop ──────────────────────────────────────────────────────────

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 animate-modal-in">{children}</div>
      <style>{`
        @keyframes modal-in {
          0% { transform: scale(0.95) translateY(10px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-modal-in { animation: modal-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

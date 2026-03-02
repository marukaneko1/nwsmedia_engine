"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessEmail } from "@/lib/email-update-action";
import { cn } from "@/lib/utils";

interface EditableEmailProps {
  businessId: number;
  currentEmail: string | null;
}

export function EditableEmail({ businessId, currentEmail }: EditableEmailProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    const value = inputRef.current?.value ?? "";
    if (value.trim() === (currentEmail ?? "").trim()) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await updateBusinessEmail(businessId, value);

    if (result.ok) {
      setSuccess(true);
      setEditing(false);
      router.refresh();
      setTimeout(() => setSuccess(false), 2000);
    } else {
      setError(result.error ?? "Failed to update");
    }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditing(false);
      setError(null);
    }
  };

  if (!editing) {
    return (
      <p className="flex items-center gap-2">
        <span>Email: {currentEmail || "—"}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          Edit
        </button>
        {success && (
          <span className="text-xs text-emerald-600">Saved!</span>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Email:</span>
        <input
          ref={inputRef}
          type="email"
          defaultValue={currentEmail ?? ""}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={saving}
          placeholder="email@example.com"
          className={cn(
            "h-7 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
            saving && "opacity-50"
          )}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError(null); }}
          disabled={saving}
          className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

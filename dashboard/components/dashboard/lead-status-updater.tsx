"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus } from "@/lib/lifecycle-actions";
import { Button } from "@/components/ui/button";

const STATUSES = [
  "lead",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "won",
  "lost",
];

interface LeadStatusUpdaterProps {
  businessId: number;
  currentStatus: string | null;
}

export function LeadStatusUpdater({
  businessId,
  currentStatus,
}: LeadStatusUpdaterProps) {
  const router = useRouter();
  const selectRef = useRef<HTMLSelectElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const selectedStatus = selectRef.current?.value;
    if (!selectedStatus) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await updateLeadStatus(businessId, selectedStatus);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update status"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <select
        ref={selectRef}
        defaultValue={currentStatus || "lead"}
        disabled={submitting}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        size="sm"
        className="w-full"
      >
        {submitting ? "Updating…" : "Update status"}
      </Button>
      {success && (
        <p className="text-xs text-emerald-600">Status updated!</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

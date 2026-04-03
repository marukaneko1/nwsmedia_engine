import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import type { Client, ProjectStatus } from '@nws/shared';

type ClientsResponse = { data: Client[]; total: number; page: number; pages: number };

function projectStatusVariant(s: ProjectStatus): 'green' | 'yellow' | 'blue' | 'gray' | 'red' {
  switch (s) {
    case 'in_progress':
      return 'blue';
    case 'complete':
      return 'green';
    case 'revision_requested':
      return 'yellow';
    case 'awaiting_approval':
      return 'yellow';
    case 'paused':
      return 'gray';
    case 'not_started':
      return 'gray';
    default:
      return 'gray';
  }
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'revision_requested', label: 'Revision requested' },
  { value: 'complete', label: 'Complete' },
  { value: 'paused', label: 'Paused' },
];

const PHASE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'design', label: 'Design' },
  { value: 'development', label: 'Development' },
  { value: 'review', label: 'Review' },
  { value: 'delivery', label: 'Delivery' },
];

export function OpsProjects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin/projects' : '/ops/projects';
  const { data, loading, error, refetch } = useApiQuery<ClientsResponse>('/clients?limit=100');

  const [updateClient, setUpdateClient] = useState<Client | null>(null);
  const [project_status, setProjectStatus] = useState<ProjectStatus>('in_progress');
  const [current_phase, setCurrentPhase] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = data?.data ?? [];

  const openUpdate = (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormError(null);
    setUpdateClient(c);
    setProjectStatus(c.project_status);
    setCurrentPhase(c.current_phase ?? '');
  };

  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateClient) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch(`/clients/${updateClient.id}`, {
        project_status,
        current_phase: current_phase || null,
      });
      setUpdateClient(null);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        {user && <p className="text-sm text-gray-500">Track delivery phases</p>}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <Card>
        <DataTable
          loading={loading}
          data={rows}
          emptyMessage="No client projects"
          onRowClick={(c) => navigate(`${basePath}/${c.id}`)}
          columns={[
            { key: 'company_name', header: 'Client company' },
            {
              key: 'project_status',
              header: 'Project status',
              render: (c) => <Badge variant={projectStatusVariant(c.project_status)}>{c.project_status.replace(/_/g, ' ')}</Badge>,
            },
            {
              key: 'current_phase',
              header: 'Current phase',
              render: (c) => c.current_phase ?? '—',
            },
            {
              key: 'expected_delivery_date',
              header: 'Delivery date',
              render: (c) => (c.expected_delivery_date ? new Date(c.expected_delivery_date).toLocaleDateString() : '—'),
            },
            {
              key: 'revisions',
              header: 'Revisions',
              render: (c) => `${c.revisions_used} / ${c.revision_limit}`,
            },
            {
              key: 'actions',
              header: '',
              render: (c) => (
                <Button size="sm" variant="secondary" onClick={(e) => openUpdate(c, e)}>
                  Update status
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={!!updateClient} onClose={() => setUpdateClient(null)} title="Update project status">
        <form onSubmit={submitUpdate} className="space-y-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Select
            label="Project status"
            options={STATUS_OPTIONS}
            value={project_status}
            onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
          />
          <Select
            label="Current phase"
            options={PHASE_OPTIONS}
            value={current_phase}
            onChange={(e) => setCurrentPhase(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUpdateClient(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

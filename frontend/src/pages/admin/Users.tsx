import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { User, UserRole, UserStatus } from '@nws/shared';

type PaginatedUsers = { data: User[]; total: number; page: number; pages: number };
type TeamsResponse = { data: { id: string; name: string }[] };

function roleBadgeVariant(role: UserRole): 'blue' | 'purple' | 'yellow' | 'red' | 'gray' {
  switch (role) {
    case 'va': return 'blue';
    case 'closer': return 'purple';
    case 'ops': return 'yellow';
    case 'admin': return 'red';
    default: return 'gray';
  }
}

function statusBadgeVariant(status: UserStatus): 'green' | 'gray' | 'red' {
  switch (status) {
    case 'active': return 'green';
    case 'inactive': return 'gray';
    case 'suspended': return 'red';
    default: return 'gray';
  }
}

const ROLE_OPTIONS = [
  { value: 'va', label: 'VA' },
  { value: 'closer', label: 'Closer' },
  { value: 'ops', label: 'Ops' },
  { value: 'admin', label: 'Admin' },
];

const ROLE_OPTIONS_EDIT = [...ROLE_OPTIONS, { value: 'client', label: 'Client' }];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const SCHEDULE_OPTIONS = [
  { value: '', label: 'Off' },
  { value: '9am-5pm', label: '9 AM - 5 PM' },
  { value: '10am-6pm', label: '10 AM - 6 PM' },
  { value: '8am-4pm', label: '8 AM - 4 PM' },
  { value: '12pm-8pm', label: '12 PM - 8 PM' },
  { value: '9am-1pm', label: '9 AM - 1 PM' },
  { value: '1pm-5pm', label: '1 PM - 5 PM' },
  { value: 'flexible', label: 'Flexible' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { data, loading, error, refetch } = useApiQuery<PaginatedUsers>('/users?limit=100');
  const { data: teamsData } = useApiQuery<TeamsResponse>('/teams');

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'va' as UserRole,
    phone: '',
    personal_email: '',
    team_id: '',
    join_date: new Date().toISOString().split('T')[0],
    emergency_contact_name: '',
    emergency_contact_phone: '',
    schedule: { monday: '9am-5pm', tuesday: '9am-5pm', wednesday: '9am-5pm', thursday: '9am-5pm', friday: '9am-5pm', saturday: '', sunday: '' } as Record<string, string>,
  });

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    role: 'va' as UserRole,
    phone: '',
    personal_email: '',
    team_id: '',
    status: 'active' as UserStatus,
    join_date: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bio: '',
    schedule: {} as Record<string, string>,
  });

  const teamName = (teamId?: string) => {
    if (!teamId) return '—';
    const t = teamsData?.data?.find((x) => x.id === teamId);
    return t?.name ?? teamId.slice(0, 8);
  };

  const teamOptions = [{ value: '', label: 'No team' }, ...(teamsData?.data ?? []).map((t) => ({ value: t.id, label: t.name }))];

  const openCreate = () => {
    setFormError(null);
    setCreateForm({
      email: '', password: '', first_name: '', last_name: '', role: 'va',
      phone: '', personal_email: '', team_id: '',
      join_date: new Date().toISOString().split('T')[0],
      emergency_contact_name: '', emergency_contact_phone: '',
      schedule: { monday: '9am-5pm', tuesday: '9am-5pm', wednesday: '9am-5pm', thursday: '9am-5pm', friday: '9am-5pm', saturday: '', sunday: '' },
    });
    setCreateOpen(true);
  };

  const openEdit = (u: User) => {
    setFormError(null);
    setEditUser(u);
    const sched = (u.schedule && typeof u.schedule === 'object') ? u.schedule as Record<string, string> : {};
    setEditForm({
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
      phone: u.phone ?? '',
      personal_email: u.personal_email ?? '',
      team_id: u.team_id ?? '',
      status: u.status === 'deleted' ? 'inactive' : u.status,
      join_date: u.join_date ? u.join_date.split('T')[0] : '',
      emergency_contact_name: u.emergency_contact_name ?? '',
      emergency_contact_phone: u.emergency_contact_phone ?? '',
      bio: u.bio ?? '',
      schedule: {
        monday: sched.monday ?? '', tuesday: sched.tuesday ?? '', wednesday: sched.wednesday ?? '',
        thursday: sched.thursday ?? '', friday: sched.friday ?? '', saturday: sched.saturday ?? '', sunday: sched.sunday ?? '',
      },
    });
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/users', {
        email: createForm.email,
        password: createForm.password,
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        role: createForm.role,
        phone: createForm.phone || undefined,
        personal_email: createForm.personal_email || undefined,
        team_id: createForm.team_id || undefined,
        join_date: createForm.join_date || undefined,
        emergency_contact_name: createForm.emergency_contact_name || undefined,
        emergency_contact_phone: createForm.emergency_contact_phone || undefined,
        schedule: createForm.schedule,
      });
      setCreateOpen(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch(`/users/${editUser.id}`, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        role: editForm.role,
        phone: editForm.phone || null,
        personal_email: editForm.personal_email || null,
        team_id: editForm.team_id || null,
        status: editForm.status,
        join_date: editForm.join_date || null,
        emergency_contact_name: editForm.emergency_contact_name || null,
        emergency_contact_phone: editForm.emergency_contact_phone || null,
        bio: editForm.bio || null,
        schedule: editForm.schedule,
      });
      setEditUser(null);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmUser) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteConfirmUser.id}`);
      setDeleteConfirmUser(null);
      setEditUser(null);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete user');
      setDeleteConfirmUser(null);
    } finally {
      setDeleting(false);
    }
  };

  const rows = data?.data ?? [];

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          {currentUser && <p className="text-sm text-gray-500">Manage team accounts</p>}
        </div>
        <Button onClick={openCreate}>Create User</Button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <Card>
        <DataTable
          loading={loading}
          data={rows}
          onRowClick={openEdit}
          emptyMessage="No users found"
          columns={[
            { key: 'name', header: 'Name', render: (u) => (
              <div>
                <span className="font-medium">{u.first_name} {u.last_name}</span>
                {u.username && <span className="ml-2 text-xs text-gray-400">@{u.username}</span>}
              </div>
            )},
            { key: 'email', header: 'Email', render: (u) => (
              <div className="text-sm">
                <div>{u.email}</div>
                {u.personal_email && <div className="text-xs text-gray-400">{u.personal_email}</div>}
              </div>
            )},
            { key: 'role', header: 'Role', render: (u) => <Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge> },
            { key: 'team', header: 'Team', render: (u) => teamName(u.team_id) },
            { key: 'join_date', header: 'Joined', render: (u) => fmt(u.join_date) },
            { key: 'status', header: 'Status', render: (u) => <Badge variant={statusBadgeVariant(u.status)}>{u.status}</Badge> },
            { key: 'profile', header: 'Profile', render: (u) => (
              u.profile_completed
                ? <Badge variant="green">Complete</Badge>
                : <Badge variant="yellow">Incomplete</Badge>
            )},
            { key: 'actions', header: '', render: (u) => u.id !== currentUser?.id ? (
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmUser(u); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                title="Delete user"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : null },
          ]}
        />
      </Card>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create User" size="lg">
        <form onSubmit={submitCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First Name" required value={createForm.first_name} onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })} />
            <Input label="Last Name" required value={createForm.last_name} onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })} />
            <Input label="Work Email" type="email" required value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            <Input label="Password" type="password" required value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            <Select label="Role" options={ROLE_OPTIONS} value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })} />
            <Select label="Team" options={teamOptions} value={createForm.team_id} onChange={(e) => setCreateForm({ ...createForm, team_id: e.target.value })} />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Contact</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
            <Input label="Personal Email" type="email" value={createForm.personal_email} onChange={(e) => setCreateForm({ ...createForm, personal_email: e.target.value })} />
            <Input label="Join Date" type="date" value={createForm.join_date} onChange={(e) => setCreateForm({ ...createForm, join_date: e.target.value })} />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Emergency Contact</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={createForm.emergency_contact_name} onChange={(e) => setCreateForm({ ...createForm, emergency_contact_name: e.target.value })} />
            <Input label="Phone" value={createForm.emergency_contact_phone} onChange={(e) => setCreateForm({ ...createForm, emergency_contact_phone: e.target.value })} />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Schedule</p>
          <div className="space-y-2">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-20 text-sm capitalize text-gray-600">{day}</span>
                <Select
                  options={SCHEDULE_OPTIONS}
                  value={createForm.schedule[day] || ''}
                  onChange={(e) => setCreateForm({ ...createForm, schedule: { ...createForm.schedule, [day]: e.target.value } })}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="lg">
        <form onSubmit={submitEdit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {formError && <p className="text-sm text-red-600">{formError}</p>}

          {editUser?.username && (
            <div className="rounded-lg bg-gray-50 border px-4 py-2 text-sm">
              <span className="text-gray-500">Username:</span> <span className="font-medium">@{editUser.username}</span>
              <span className="text-gray-300 mx-2">|</span>
              <span className="text-gray-500">Email:</span> <span className="font-medium">{editUser.email}</span>
            </div>
          )}

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First Name" required value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            <Input label="Last Name" required value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            <Select label="Role" options={ROLE_OPTIONS_EDIT} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })} />
            <Select label="Status" options={STATUS_OPTIONS} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UserStatus })} />
            <Select label="Team" options={teamOptions} value={editForm.team_id} onChange={(e) => setEditForm({ ...editForm, team_id: e.target.value })} />
            <Input label="Join Date" type="date" value={editForm.join_date} onChange={(e) => setEditForm({ ...editForm, join_date: e.target.value })} />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Contact</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <Input label="Personal Email" type="email" value={editForm.personal_email} onChange={(e) => setEditForm({ ...editForm, personal_email: e.target.value })} />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Emergency Contact</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={editForm.emergency_contact_name} onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} />
            <Input label="Phone" value={editForm.emergency_contact_phone} onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Schedule</p>
          <div className="space-y-2">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-20 text-sm capitalize text-gray-600">{day}</span>
                <Select
                  options={SCHEDULE_OPTIONS}
                  value={editForm.schedule[day] || ''}
                  onChange={(e) => setEditForm({ ...editForm, schedule: { ...editForm.schedule, [day]: e.target.value } })}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
              rows={2}
              value={editForm.bio}
              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <div>
              {editUser && editUser.id !== currentUser?.id && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteConfirmUser(editUser)}
                >
                  Delete Account
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmUser} onClose={() => setDeleteConfirmUser(null)} title="Delete User" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to delete <span className="font-semibold">{deleteConfirmUser?.first_name} {deleteConfirmUser?.last_name}</span>?
            This will deactivate their account and anonymize their personal data.
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">This action cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2 border-t dark:border-[#1a1a1a]">
            <Button type="button" variant="secondary" onClick={() => setDeleteConfirmUser(null)} disabled={deleting}>Cancel</Button>
            <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

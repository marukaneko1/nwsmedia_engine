import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { api } from '../utils/api';

const ROLE_OPTIONS = [
  { value: '', label: 'Select your role...' },
  { value: 'va', label: 'VA (Cold Caller)' },
  { value: 'closer', label: 'Closer (Sales Rep)' },
  { value: 'ops', label: 'Ops (Project Manager)' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const SCHEDULE_OPTIONS = [
  { value: '', label: 'Off' },
  { value: '9am-5pm', label: '9:00 AM - 5:00 PM' },
  { value: '10am-6pm', label: '10:00 AM - 6:00 PM' },
  { value: '8am-4pm', label: '8:00 AM - 4:00 PM' },
  { value: '12pm-8pm', label: '12:00 PM - 8:00 PM' },
  { value: '9am-1pm', label: '9:00 AM - 1:00 PM (Half)' },
  { value: '1pm-5pm', label: '1:00 PM - 5:00 PM (Half)' },
  { value: 'flexible', label: 'Flexible' },
];

type Step = 'personal' | 'work' | 'schedule' | 'review';

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('personal');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    personal_email: '',
    phone: '',
    password: '',
    confirm_password: '',
    date_of_birth: '',
    address_street: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    role: '',
    join_date: new Date().toISOString().split('T')[0],
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bio: '',
    schedule: {
      monday: '9am-5pm',
      tuesday: '9am-5pm',
      wednesday: '9am-5pm',
      thursday: '9am-5pm',
      friday: '9am-5pm',
      saturday: '',
      sunday: '',
    } as Record<string, string>,
  });

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const setSchedule = (day: string, value: string) =>
    setForm((f) => ({ ...f, schedule: { ...f.schedule, [day]: value } }));

  const generatedUsername = form.first_name && form.last_name
    ? `${form.first_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${form.last_name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    : '';

  const validateStep = (): boolean => {
    setError('');
    if (step === 'personal') {
      if (!form.first_name || !form.last_name || !form.personal_email || !form.phone) {
        setError('Please fill in all required fields.');
        return false;
      }
      if (!form.password || form.password.length < 8) {
        setError('Password must be at least 8 characters.');
        return false;
      }
      if (form.password !== form.confirm_password) {
        setError('Passwords do not match.');
        return false;
      }
    }
    if (step === 'work') {
      if (!form.role) {
        setError('Please select your role.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    const steps: Step[] = ['personal', 'work', 'schedule', 'review'];
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  };

  const prevStep = () => {
    const steps: Step[] = ['personal', 'work', 'schedule', 'review'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await api.post<{ token: string; user: any }>('/auth/register', {
        first_name: form.first_name,
        last_name: form.last_name,
        password: form.password,
        personal_email: form.personal_email,
        phone: form.phone,
        role: form.role,
        date_of_birth: form.date_of_birth || undefined,
        address_street: form.address_street || undefined,
        address_city: form.address_city || undefined,
        address_state: form.address_state || undefined,
        address_zip: form.address_zip || undefined,
        join_date: form.join_date || undefined,
        schedule: form.schedule,
        emergency_contact_name: form.emergency_contact_name || undefined,
        emergency_contact_phone: form.emergency_contact_phone || undefined,
        bio: form.bio || undefined,
      });

      localStorage.setItem('token', res.token);
      navigate('/');
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-8">
      {(['personal', 'work', 'schedule', 'review'] as Step[]).map((s, i) => {
        const labels = ['Personal Info', 'Work Details', 'Schedule', 'Review'];
        const isActive = s === step;
        const isPast = ['personal', 'work', 'schedule', 'review'].indexOf(step) > i;
        return (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className={`h-0.5 w-8 ${isPast ? 'bg-neutral-800' : 'bg-gray-200 dark:bg-[#111]'}`} />}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isActive ? 'bg-neutral-900 text-white' : isPast ? 'bg-neutral-100 text-neutral-800 dark:bg-[#1a1a1a] dark:text-white' : 'bg-gray-100 text-gray-400 dark:bg-[#0a0a0a] dark:text-gray-500'
                }`}
              >
                {isPast ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`mt-1 text-xs ${isActive ? 'text-neutral-800 dark:text-white font-medium' : 'text-gray-400'}`}>
                {labels[i]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-6">
          <img src="/logo.jpeg" alt="NWS Media" className="mx-auto h-12 w-12 rounded-2xl object-cover mb-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Your NWS Media Account</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Fill out your employee profile to get started</p>
        </div>

        {stepIndicator}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Personal Info */}
          {step === 'personal' && (
            <Card title="Personal Information">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="First Name *" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="John" />
                  <Input label="Last Name *" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Smith" />
                </div>

                {generatedUsername && (
                  <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3 dark:bg-[#111] dark:border-neutral-800">
                    <p className="text-sm text-neutral-800 dark:text-neutral-300">
                      Your username will be: <span className="font-semibold">{generatedUsername}</span>
                    </p>
                    <p className="text-xs text-neutral-700 mt-0.5 dark:text-white">
                      Work email: {generatedUsername}@nwsmediaemail.com
                    </p>
                  </div>
                )}

                <Input label="Personal Email *" type="email" required value={form.personal_email} onChange={(e) => set('personal_email', e.target.value)} placeholder="john@gmail.com" />
                <Input label="Phone Number *" type="tel" required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Password *" type="password" required value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 8 characters" />
                  <Input label="Confirm Password *" type="password" required value={form.confirm_password} onChange={(e) => set('confirm_password', e.target.value)} placeholder="Re-enter password" />
                </div>

                <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Home Address</p>
                  <div className="space-y-3">
                    <Input label="Street" value={form.address_street} onChange={(e) => set('address_street', e.target.value)} placeholder="123 Main St" />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Input label="City" value={form.address_city} onChange={(e) => set('address_city', e.target.value)} placeholder="New York" />
                      <Input label="State" value={form.address_state} onChange={(e) => set('address_state', e.target.value)} placeholder="NY" />
                      <Input label="ZIP" value={form.address_zip} onChange={(e) => set('address_zip', e.target.value)} placeholder="10001" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={nextStep}>Continue</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 2: Work Details */}
          {step === 'work' && (
            <Card title="Work Details">
              <div className="space-y-5">
                <Select label="Your Role *" options={ROLE_OPTIONS} value={form.role} onChange={(e) => set('role', e.target.value)} />

                <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gray-600 space-y-2 dark:bg-[#0a0a0a] dark:border-[#1a1a1a] dark:text-gray-400">
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">VA (Cold Caller):</span> Qualify leads and hand them to closers</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Closer (Sales Rep):</span> Manage deals from discovery to close</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Ops (Project Manager):</span> Manage client projects and deliverables</p>
                </div>

                <Input label="Start Date" type="date" value={form.join_date} onChange={(e) => set('join_date', e.target.value)} />

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Emergency Contact</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Contact Name" value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} placeholder="Jane Smith" />
                    <Input label="Contact Phone" type="tel" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} placeholder="(555) 987-6543" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short Bio</label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100"
                    rows={3}
                    value={form.bio}
                    onChange={(e) => set('bio', e.target.value)}
                    placeholder="A few words about yourself..."
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <Button type="button" variant="secondary" onClick={prevStep}>Back</Button>
                  <Button type="button" onClick={nextStep}>Continue</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Schedule */}
          {step === 'schedule' && (
            <Card title="Weekly Schedule">
              <div className="space-y-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">Set your typical working hours for each day. Leave as "Off" for days you don't work.</p>

                <div className="space-y-3">
                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-4">
                      <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{day}</span>
                      <div className="flex-1">
                        <Select
                          options={SCHEDULE_OPTIONS}
                          value={form.schedule[day] || ''}
                          onChange={(e) => setSchedule(day, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-2">
                  <Button type="button" variant="secondary" onClick={prevStep}>Back</Button>
                  <Button type="button" onClick={nextStep}>Continue</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <Card title="Review Your Information">
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Personal</h3>
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
                    <div><span className="text-gray-500">Name:</span> <span className="font-medium">{form.first_name} {form.last_name}</span></div>
                    <div><span className="text-gray-500">Username:</span> <span className="font-medium">{generatedUsername}</span></div>
                    <div><span className="text-gray-500">Personal Email:</span> <span className="font-medium">{form.personal_email}</span></div>
                    <div><span className="text-gray-500">Work Email:</span> <span className="font-medium">{generatedUsername}@nwsmediaemail.com</span></div>
                    <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{form.phone}</span></div>
                    {form.date_of_birth && <div><span className="text-gray-500">DOB:</span> <span className="font-medium">{new Date(form.date_of_birth).toLocaleDateString()}</span></div>}
                    {form.address_city && <div><span className="text-gray-500">Location:</span> <span className="font-medium">{form.address_city}, {form.address_state} {form.address_zip}</span></div>}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Work</h3>
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
                    <div><span className="text-gray-500">Role:</span> <span className="font-medium capitalize">{form.role}</span></div>
                    <div><span className="text-gray-500">Start Date:</span> <span className="font-medium">{form.join_date ? new Date(form.join_date).toLocaleDateString() : 'Today'}</span></div>
                    {form.emergency_contact_name && <div><span className="text-gray-500">Emergency Contact:</span> <span className="font-medium">{form.emergency_contact_name} ({form.emergency_contact_phone})</span></div>}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Schedule</h3>
                  <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 text-sm">
                    {DAYS.map((day) => (
                      <div key={day}>
                        <span className="text-gray-500 capitalize">{day}:</span>{' '}
                        <span className="font-medium">{form.schedule[day] || 'Off'}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="flex justify-between pt-4 border-t">
                  <Button type="button" variant="secondary" onClick={prevStep}>Back</Button>
                  <Button type="submit" disabled={submitting} size="lg">
                    {submitting ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-neutral-700 hover:text-neutral-800 dark:text-white dark:hover:text-neutral-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import {
  getOpenShifts, createOpenShift, offerForOpenShift, cancelOpenShift, fillOpenShift,
  getSchedules,
  OpenShift, Schedule,
} from '../api';
import { PageHeader, useToast } from '../components/ui';

type OpenShiftApplicant = {
  employee_id: number;
  employee_name?: string | null;
  offer_id?: number;
  status?: string;
};

type OpenShiftListItem = OpenShift & {
  applicants?: OpenShiftApplicant[];
  offers?: OpenShiftApplicant[];
  source_employee_name?: string | null;
};

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function parseCertifications(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function formatFullDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return FULL_DATE_FORMATTER.format(new Date(y, m - 1, d));
}

function formatDurationHours(date: string, startTime: string, endTime: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  if (
    [y, m, d, startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))
  ) {
    return 'Unknown length';
  }

  const start = new Date(y, m - 1, d, startHour, startMinute, 0, 0);
  const end = new Date(y, m - 1, d, endHour, endMinute, 0, 0);
  let hours = (end.getTime() - start.getTime()) / 3600000;
  if (hours <= 0) hours += 24;

  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function getApplicants(shift: OpenShiftListItem): OpenShiftApplicant[] {
  const candidates = shift.applicants ?? shift.offers;
  if (!Array.isArray(candidates)) return [];
  return candidates.filter((candidate) => {
    const hasEmployeeId = typeof candidate?.employee_id === 'number' && Number.isFinite(candidate.employee_id);
    const isPending = !candidate.status || candidate.status === 'pending';
    return hasEmployeeId && isPending;
  });
}

function getReasonBadges(shift: OpenShiftListItem): string[] {
  const reasons = new Set<string>();
  const normalizedReason = (shift.reason || '').toLowerCase();

  if (normalizedReason.includes('callout')) reasons.add('Call-Out');
  if (normalizedReason.includes('understaff')) reasons.add('Understaffed');
  if (normalizedReason.includes('drop') || shift.source_employee_name) reasons.add('Dropped Shift');

  return Array.from(reasons);
}

export default function OpenShiftsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openShifts, setOpenShifts] = useState<OpenShiftListItem[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [assigningKey, setAssigningKey] = useState<string | null>(null);

  // Create form state (manager only)
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    schedule_id: '', date: '', start_time: '09:00', end_time: '17:00',
    role: '', required_certifications: '', reason: 'callout',
  });
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [shifts, scheds] = await Promise.all([
        getOpenShifts({ status: statusFilter || undefined }),
        getSchedules(),
      ]);
      setOpenShifts(shifts as OpenShiftListItem[]);
      setSchedules(scheds);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOffer(shiftId: number) {
    setError(null);
    try {
      await offerForOpenShift(shiftId);
      toast('Your offer for the shift has been submitted!', { variant: 'success' });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      const certs = createForm.required_certifications
        ? createForm.required_certifications.split(',').map(c => c.trim()).filter(Boolean)
        : [];
      await createOpenShift({
        schedule_id: parseInt(createForm.schedule_id),
        date: createForm.date,
        start_time: createForm.start_time,
        end_time: createForm.end_time,
        role: createForm.role,
        required_certifications: certs,
        reason: createForm.reason,
      });
      setShowCreate(false);
      setCreateForm({ schedule_id: '', date: '', start_time: '09:00', end_time: '17:00', role: '', required_certifications: '', reason: 'callout' });
      toast('Open shift posted successfully.', { variant: 'success' });
      await loadData();
    } catch (err: any) {
      setCreateError(err.message);
    }
  }

  async function handleCancel(id: number) {
    if (!confirm('Cancel this open shift?')) return;
    try {
      await cancelOpenShift(id);
      toast('Open shift cancelled.', { variant: 'default' });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAssign(openShiftId: number, employeeId: number) {
    const key = `${openShiftId}:${employeeId}`;
    setAssigningKey(key);
    setError(null);
    try {
      await fillOpenShift(openShiftId, { employee_id: employeeId });
      toast('Open shift assigned successfully.', { variant: 'success' });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign shift.');
    } finally {
      setAssigningKey(null);
    }
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      open: 'bg-green-100 text-green-800',
      claimed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100'}`}>
        {status}
      </span>
    );
  }

  const REASON_LABELS: Record<string, string> = {
    callout: 'Call-Out Coverage', understaffed: 'Understaffed', new_demand: 'Demand Increase', other: 'Other',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Open Shift Marketplace"
        subtitle={user?.isManager
          ? 'Post open shifts and review employee offers. Eligibility is automatically checked for role, certifications, rest windows, and overtime.'
          : 'Browse available shifts. Only shifts you are eligible for (role, certifications, rest, hours) can be claimed.'}
        color="#0EA5E9"
        icon="🏪"
        actions={user?.isManager
          ? (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sky-600 transition-colors"
            >
              + Post Open Shift
            </button>
          )
          : undefined}
      />

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['open', 'claimed', 'cancelled', ''].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {/* Create modal */}
      {showCreate && user?.isManager && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Post Open Shift</h2>
            {createError && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{createError}</div>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                <select
                  required value={createForm.schedule_id}
                  onChange={e => {
                    const schedId = e.target.value;
                    const selected = schedules.find(s => String(s.id) === schedId);
                    setCreateForm(f => ({
                      ...f,
                      schedule_id: schedId,
                      date: selected ? selected.week_start : f.date
                    }));
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select schedule…</option>
                  {schedules.map(s => <option key={s.id} value={s.id}>{s.week_start} ({s.status})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" required value={createForm.date}
                    onChange={e => setCreateForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    required value={createForm.role}
                    onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select Role…</option>
                    {['Server', 'Line Cook', 'Head Chef', 'Sous Chef', 'Dishwasher', 'Host', 'Busser', 'Food Runner', 'Expo', 'Bar', 'Manager'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input type="time" required value={createForm.start_time}
                    onChange={e => setCreateForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <input type="time" required value={createForm.end_time}
                    onChange={e => setCreateForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select value={createForm.reason}
                  onChange={e => setCreateForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(REASON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Required Certifications <span className="text-gray-400">(comma-separated)</span></label>
                <input type="text" value={createForm.required_certifications} placeholder="e.g. TIPS, ServSafe"
                  onChange={e => setCreateForm(f => ({ ...f, required_certifications: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Post Shift</button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open shifts list */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : openShifts.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl">
          <p className="text-lg font-medium">No open shifts found</p>
          <p className="text-sm mt-1">{statusFilter === 'open' ? 'All shifts are currently covered.' : `No ${statusFilter} shifts.`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {openShifts.map(shift => {
            const formattedDate = formatFullDateLabel(shift.date);
            const duration = formatDurationHours(shift.date, shift.start_time, shift.end_time);
            const certs = parseCertifications(shift.required_certifications);
            const applicants = getApplicants(shift);
            const reasonBadges = getReasonBadges(shift);
            return (
            <div key={shift.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{shift.role}</span>
                  {statusBadge(shift.status)}
                  {shift.reason && (
                    <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                      {REASON_LABELS[shift.reason] ?? shift.reason}
                    </span>
                  )}
                  {reasonBadges.map((badge) => (
                    <span key={`${shift.id}-${badge}`} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {badge}
                    </span>
                  ))}
                </div>
                <div className="text-sm text-gray-600">
                  {formattedDate}
                  {' '}&bull;{' '}{shift.start_time} - {shift.end_time}
                  {' '}&bull;{' '}{duration}
                </div>
                {shift.claimed_by_name && (
                  <div className="text-xs text-blue-700 mt-0.5">Claimed by: {shift.claimed_by_name}</div>
                )}
                {shift.offer_count !== undefined && shift.offer_count > 0 && (
                  <div className="text-xs text-gray-500 mt-0.5">{shift.offer_count} offer{shift.offer_count !== 1 ? 's' : ''} pending</div>
                )}
                {certs.length > 0 && (
                  <div className="text-xs text-purple-700 mt-0.5">Requires: {certs.join(', ')}</div>
                )}

                {user?.isManager && shift.status === 'open' && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Applicants</div>
                    {applicants.length === 0 ? (
                      <div className="mt-1 text-xs text-slate-500">No pending applicants yet.</div>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {applicants.map((applicant) => {
                          const loading = assigningKey === `${shift.id}:${applicant.employee_id}`;
                          return (
                            <div key={`${shift.id}-${applicant.employee_id}`} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5">
                              <span className="truncate text-sm text-slate-700">
                                {applicant.employee_name || `Employee #${applicant.employee_id}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAssign(shift.id, applicant.employee_id)}
                                disabled={loading}
                                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {loading ? 'Assigning...' : 'Assign'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Worker Eligibility Feedback */}
                {!user?.isManager && shift.eligibility && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                    {shift.eligibility.eligible ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        ✓ Eligible to claim
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          ✕ Ineligible
                        </span>
                        {shift.eligibility.reasons?.map((reason, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                {!user?.isManager && shift.status === 'open' && (
                  <button
                    onClick={() => handleOffer(shift.id)}
                    disabled={Boolean(shift.eligibility && !shift.eligibility.eligible)}
                    title={shift.eligibility && !shift.eligibility.eligible ? shift.eligibility.reasons?.join('; ') : 'Submit offer to work this shift'}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      shift.eligibility && !shift.eligibility.eligible
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    Offer to Work
                  </button>
                )}
                {user?.isManager && shift.status === 'open' && (
                  <button
                    onClick={() => handleCancel(shift.id)}
                    className="border border-red-300 text-red-600 px-3 py-1.5 rounded-lg text-sm hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

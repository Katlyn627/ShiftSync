import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import {
  getOpenShifts, createOpenShift, offerForOpenShift, cancelOpenShift,
  getSchedules,
  OpenShift, Schedule,
} from '../api';
import { PageHeader, useToast } from '../components/ui';

export default function OpenShiftsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');

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
      setOpenShifts(shifts);
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
                  onChange={e => setCreateForm(f => ({ ...f, schedule_id: e.target.value }))}
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
                  <input type="text" required value={createForm.role} placeholder="e.g. Server"
                    onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
          {openShifts.map(shift => (
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
                </div>
                <div className="text-sm text-gray-600">
                  {new Date(shift.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' '}&bull;{' '}{shift.start_time} – {shift.end_time}
                </div>
                {shift.claimed_by_name && (
                  <div className="text-xs text-blue-700 mt-0.5">Claimed by: {shift.claimed_by_name}</div>
                )}
                {shift.offer_count !== undefined && shift.offer_count > 0 && (
                  <div className="text-xs text-gray-500 mt-0.5">{shift.offer_count} offer{shift.offer_count !== 1 ? 's' : ''} pending</div>
                )}
                {(() => {
                  const certs = JSON.parse(shift.required_certifications || '[]') as string[];
                  return certs.length > 0 ? (
                    <div className="text-xs text-purple-700 mt-0.5">Requires: {certs.join(', ')}</div>
                  ) : null;
                })()}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!user?.isManager && shift.status === 'open' && (
                  <button
                    onClick={() => handleOffer(shift.id)}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
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
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  getEmployees, updateEmployee, getAvailability, setAvailability, deleteAvailability,
  getTimeOffRequests, createTimeOffRequest, cancelTimeOffRequest,
  Employee, Availability, TimeOffRequest,
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Badge, Input } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AVATAR_BG: Record<string, string> = {
  Manager: 'bg-violet-100 text-violet-700',
  Server:  'bg-blue-100 text-blue-700',
  Kitchen: 'bg-orange-100 text-orange-700',
  Bar:     'bg-emerald-100 text-emerald-700',
  Host:    'bg-pink-100 text-pink-700',
};

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function roleVariant(role: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    Manager: 'manager', Server: 'server', Kitchen: 'kitchen', Bar: 'bar', Host: 'host',
  };
  return map[role] ?? 'default';
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/** Returns YYYY-MM-DD that is `days` days from today */
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

type DayAvailType = 'none' | 'specific' | 'open' | 'unavailable';
interface DayAvailState {
  type: DayAvailType;
  start_time: string;
  end_time: string;
  saving: boolean;
}

function defaultDayAvailState(): Record<number, DayAvailState> {
  const init: Record<number, DayAvailState> = {};
  for (let d = 0; d < 7; d++) {
    init[d] = { type: 'none', start_time: '09:00', end_time: '17:00', saving: false };
  }
  return init;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isManager = user?.isManager ?? false;

  const [myEmployee, setMyEmployee]         = useState<Employee | null>(null);
  const [availability, setAvailabilityList] = useState<Availability[]>([]);
  const [colleagues, setColleagues]         = useState<Employee[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading]               = useState(true);

  // Profile edit form
  const [editProfile, setEditProfile]   = useState(false);
  const [profileForm, setProfileForm]   = useState({ email: '', phone: '', weekly_hours_max: 40 });
  const [savingProfile, setSavingProfile] = useState(false);

  // Per-day availability state
  const [dayAvailState, setDayAvailState] = useState<Record<number, DayAvailState>>(defaultDayAvailState);

  // Time-off form
  const minTimeOffDate = addDays(14);
  const [timeOffForm, setTimeOffForm] = useState({ start_date: minTimeOffDate, end_date: minTimeOffDate, reason: '' });
  const [savingTimeOff, setSavingTimeOff] = useState(false);

  // Profile photo
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const all = await getEmployees();
      const empId = user?.employeeId;
      if (empId) {
        const me = all.find(e => e.id === empId);
        if (me) {
          setMyEmployee(me);
          setProfileForm({
            email: me.email ?? '',
            phone: me.phone ?? '',
            weekly_hours_max: me.weekly_hours_max,
          });
          // Same-role colleagues (excluding self)
          setColleagues(all.filter(e => e.role === me.role && e.id !== empId));
          // Load availability and build per-day state
          const avail = await getAvailability(empId);
          setAvailabilityList(avail);
          const newDayState = defaultDayAvailState();
          for (const a of avail) {
            const validTypes: DayAvailType[] = ['specific', 'open', 'unavailable'];
            const type: DayAvailType = validTypes.includes(a.availability_type as DayAvailType)
              ? (a.availability_type as DayAvailType)
              : 'specific';
            newDayState[a.day_of_week] = {
              type,
              start_time: a.start_time,
              end_time: a.end_time,
              saving: false,
            };
          }
          setDayAvailState(newDayState);
        }
      }
      // Load time-off requests
      const requests = await getTimeOffRequests();
      setTimeOffRequests(requests);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user?.employeeId]);

  const handleSaveProfile = async () => {
    if (!myEmployee) return;
    setSavingProfile(true);
    try {
      const updated = await updateEmployee(myEmployee.id, {
        email: profileForm.email,
        phone: profileForm.phone,
        weekly_hours_max: profileForm.weekly_hours_max,
      });
      setMyEmployee(updated);
      setEditProfile(false);
    } catch (err: any) {
      alert('Error saving profile: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveDayAvailability = async (day: number) => {
    if (!myEmployee) return;
    const state = dayAvailState[day];
    setDayAvailState(prev => ({ ...prev, [day]: { ...prev[day], saving: true } }));
    try {
      if (state.type === 'none') {
        // Remove the availability entry for this day
        try { await deleteAvailability(myEmployee.id, day); } catch { /* not found is ok */ }
        setAvailabilityList(prev => prev.filter(a => a.day_of_week !== day));
      } else {
        const saved = await setAvailability(myEmployee.id, {
          day_of_week: day,
          availability_type: state.type,
          ...(state.type === 'specific' ? { start_time: state.start_time, end_time: state.end_time } : {}),
        });
        setAvailabilityList(prev => {
          const filtered = prev.filter(a => a.day_of_week !== day);
          return [...filtered, saved];
        });
      }
    } catch (err: any) {
      alert('Error saving availability: ' + err.message);
    } finally {
      setDayAvailState(prev => ({ ...prev, [day]: { ...prev[day], saving: false } }));
    }
  };

  const handleRequestTimeOff = async () => {
    if (!myEmployee) return;
    setSavingTimeOff(true);
    try {
      const created = await createTimeOffRequest({
        start_date: timeOffForm.start_date,
        end_date: timeOffForm.end_date,
        reason: timeOffForm.reason || undefined,
      });
      setTimeOffRequests(prev => [created, ...prev]);
      setTimeOffForm({ start_date: minTimeOffDate, end_date: minTimeOffDate, reason: '' });
    } catch (err: any) {
      alert('Error submitting time-off request: ' + err.message);
    } finally {
      setSavingTimeOff(false);
    }
  };

  const handleCancelTimeOff = async (id: number) => {
    if (!confirm('Cancel this time-off request?')) return;
    try {
      await cancelTimeOffRequest(id);
      setTimeOffRequests(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert('Error cancelling request: ' + err.message);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myEmployee) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      alert('Image must be smaller than 2 MB.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const updated = await updateEmployee(myEmployee.id, { photo_url: dataUrl });
      setMyEmployee(updated);
    } catch (err: any) {
      alert('Error uploading photo: ' + err.message);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!myEmployee || !confirm('Remove your profile photo?')) return;
    try {
      const updated = await updateEmployee(myEmployee.id, { photo_url: null });
      setMyEmployee(updated);
    } catch (err: any) {
      alert('Error removing photo: ' + err.message);
    }
  };

  // Filter time-off requests: non-managers see only their own
  const myTimeOffRequests = isManager
    ? timeOffRequests
    : timeOffRequests.filter(r => r.employee_id === myEmployee?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading profile…
      </div>
    );
  }

  if (!myEmployee && !isManager) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your account details</p>
        </div>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary text-lg font-bold flex items-center justify-center border border-primary/20">
              {initials(user?.employeeName || user?.username || '?')}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{user?.employeeName || user?.username}</h2>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Your account isn't linked to an employee record. Please contact a manager to complete your profile setup.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View and update your profile, availability, and contact info</p>
      </div>

      {/* ── Account card for managers without a linked employee record ── */}
      {!myEmployee && isManager && (
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-violet-100 text-violet-700 text-lg font-bold flex items-center justify-center">
              {initials(user?.employeeName || user?.username || '?')}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">{user?.employeeName || user?.username}</h2>
                <Badge variant="manager">Manager</Badge>
              </div>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
        </Card>
      )}

      {myEmployee && (
        <>
          {/* ── Profile Card ── */}
          <Card className="p-5">
            <div className="flex items-start gap-4">
              {/* Avatar / Photo */}
              <div className="relative shrink-0 group">
                {myEmployee.photo_url ? (
                  <img
                    src={myEmployee.photo_url}
                    alt={myEmployee.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${AVATAR_BG[myEmployee.role] ?? 'bg-muted text-muted-foreground'}`}>
                    {initials(myEmployee.name)}
                  </div>
                )}
                {/* Camera overlay button */}
                <button
                  type="button"
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Change photo"
                >
                  {uploadingPhoto ? (
                    <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  )}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground">{myEmployee.name}</h2>
                  <Badge variant={roleVariant(myEmployee.role)}>{myEmployee.role}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">Max {myEmployee.weekly_hours_max}h/week · ${myEmployee.hourly_rate.toFixed(2)}/hr</p>
                {myEmployee.email && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="text-foreground font-medium">Email:</span> {myEmployee.email}
                  </p>
                )}
                {myEmployee.phone && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <span className="text-foreground font-medium">Phone:</span> {myEmployee.phone}
                  </p>
                )}
                {myEmployee.photo_url && (
                  <button
                    className="text-xs text-red-500 hover:text-red-700 transition-colors mt-1"
                    onClick={handleRemovePhoto}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditProfile(!editProfile)}>
                {editProfile ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            {editProfile && (
              <div className="mt-4 pt-4 border-t border-border space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Update Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Email"
                    type="email"
                    placeholder="your@email.com"
                    value={profileForm.email}
                    onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  />
                  <Input
                    label="Preferred Max Weekly Hours"
                    type="number"
                    min={8}
                    max={80}
                    value={profileForm.weekly_hours_max}
                    onChange={e => setProfileForm(f => ({ ...f, weekly_hours_max: Number(e.target.value) }))}
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  isLoading={savingProfile}
                >
                  Save Changes
                </Button>
              </div>
            )}
          </Card>

          {/* ── Availability ── */}
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground">My Availability</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Set your availability for each day. Check <strong>Open all day</strong> to be available any time,
              or <strong>Unavailable</strong> to mark a day off. Otherwise, set specific hours.
            </p>

            <div className="mt-4 space-y-2">
              {DAY_NAMES.map((dayName, dayIndex) => {
                const state = dayAvailState[dayIndex];
                return (
                  <div key={dayIndex} className="flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border">
                    <span className="text-sm font-medium text-foreground w-24 shrink-0">{dayName}</span>

                    {/* Open all day checkbox */}
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={state.type === 'open'}
                        onChange={e => {
                          const newType: DayAvailType = e.target.checked ? 'open' : 'none';
                          setDayAvailState(prev => ({ ...prev, [dayIndex]: { ...prev[dayIndex], type: newType } }));
                        }}
                        className="w-4 h-4 rounded border-gray-300 accent-emerald-600"
                      />
                      <span className="text-sm text-foreground">Open all day</span>
                    </label>

                    {/* Unavailable checkbox */}
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={state.type === 'unavailable'}
                        onChange={e => {
                          const newType: DayAvailType = e.target.checked ? 'unavailable' : 'none';
                          setDayAvailState(prev => ({ ...prev, [dayIndex]: { ...prev[dayIndex], type: newType } }));
                        }}
                        className="w-4 h-4 rounded border-gray-300 accent-red-500"
                      />
                      <span className="text-sm text-foreground">Unavailable</span>
                    </label>

                    {/* Specific time inputs */}
                    {(state.type === 'none' || state.type === 'specific') && (
                      <div className="flex items-center gap-2">
                        <Input
                          label=""
                          type="time"
                          className="w-28"
                          value={state.start_time}
                          onChange={e => setDayAvailState(prev => ({
                            ...prev,
                            [dayIndex]: { ...prev[dayIndex], type: 'specific', start_time: e.target.value },
                          }))}
                        />
                        <span className="text-muted-foreground text-sm">–</span>
                        <Input
                          label=""
                          type="time"
                          className="w-28"
                          value={state.end_time}
                          onChange={e => setDayAvailState(prev => ({
                            ...prev,
                            [dayIndex]: { ...prev[dayIndex], type: 'specific', end_time: e.target.value },
                          }))}
                        />
                      </div>
                    )}

                    {/* Status label */}
                    {state.type === 'open' && (
                      <span className="text-xs text-emerald-600 font-medium">All day available</span>
                    )}
                    {state.type === 'unavailable' && (
                      <span className="text-xs text-red-600 font-medium">Not available</span>
                    )}

                    <div className="ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveDayAvailability(dayIndex)}
                        disabled={state.saving}
                        isLoading={state.saving}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ── Time-Off Requests ── */}
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground">Time-Off Requests</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Requests must be submitted at least <span className="font-semibold">2 weeks</span> before the requested start date.
            </p>

            {myTimeOffRequests.length > 0 ? (
              <div className="mt-3 space-y-2">
                {myTimeOffRequests.map(r => (
                  <div key={r.id} className="flex items-start justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm gap-2">
                    <div className="flex-1 min-w-0">
                      {isManager && (
                        <p className="font-medium text-foreground text-xs mb-0.5">{r.employee_name}</p>
                      )}
                      <p className="font-medium text-foreground">{r.start_date} → {r.end_date}</p>
                      {r.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.reason}</p>}
                      {r.manager_notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">Note: {r.manager_notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                      {r.status === 'pending' && !isManager && (
                        <button
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          onClick={() => handleCancelTimeOff(r.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground italic">No time-off requests yet.</p>
            )}

            {myEmployee && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">Submit a Request</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Start Date"
                    type="date"
                    min={minTimeOffDate}
                    value={timeOffForm.start_date}
                    onChange={e => setTimeOffForm(f => ({ ...f, start_date: e.target.value, end_date: e.target.value > f.end_date ? e.target.value : f.end_date }))}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    min={timeOffForm.start_date || minTimeOffDate}
                    value={timeOffForm.end_date}
                    onChange={e => setTimeOffForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Reason (optional)"
                      type="text"
                      placeholder="e.g. family vacation"
                      value={timeOffForm.reason}
                      onChange={e => setTimeOffForm(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Earliest allowed start date: <span className="font-medium text-foreground">{minTimeOffDate}</span>
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="mt-3"
                  onClick={handleRequestTimeOff}
                  disabled={savingTimeOff}
                  isLoading={savingTimeOff}
                >
                  Submit Request
                </Button>
              </div>
            )}
          </Card>

          {/* ── Colleagues in Same Role ── */}
          {colleagues.length > 0 && (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-foreground">
                {myEmployee.role} Team Contacts
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Contact your teammates directly.</p>
              <div className="mt-3 space-y-3">
                {colleagues.map(col => (
                  <div key={col.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="shrink-0">
                      {col.photo_url ? (
                        <img
                          src={col.photo_url}
                          alt={col.name}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${AVATAR_BG[col.role] ?? 'bg-muted text-muted-foreground'}`}>
                          {initials(col.name)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{col.name}</p>
                      <p className="text-xs text-muted-foreground">{col.role}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {col.phone && (
                        <a
                          href={`tel:${col.phone}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          title={col.phone}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                          </svg>
                          Call
                        </a>
                      )}
                      {col.email && (
                        <a
                          href={`mailto:${col.email}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          title={col.email}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          Email
                        </a>
                      )}
                      {!col.email && !col.phone && (
                        <span className="text-xs text-muted-foreground italic">No contact info</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {colleagues.length === 0 && (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-foreground">{myEmployee.role} Team</h2>
              <p className="text-sm text-muted-foreground mt-2 italic">No other {myEmployee.role} team members found.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
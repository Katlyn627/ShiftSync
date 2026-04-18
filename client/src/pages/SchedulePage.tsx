import { useEffect, useMemo, useState } from 'react';
import {
  createOpenShift,
  createShift,
  createSwap,
  deleteSchedule,
  deleteShift,
  dropShift,
  Employee,
  getEmployees,
  getOpenShifts,
  getScheduleShifts,
  getSchedules,
  offerForOpenShift,
  OpenShift,
  Schedule,
  ShiftWithEmployee,
  updateSchedule,
  updateShift,
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Input, NATIVE_SELECT_CLASS, PageHeader, useToast } from '../components/ui';

function getCurrentWeekStartISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function toSortableValue(shift: ShiftWithEmployee) {
  return `${shift.date} ${shift.start_time}`;
}

function toISODate(date: Date) {
  const adjusted = new Date(date);
  adjusted.setMinutes(adjusted.getMinutes() - adjusted.getTimezoneOffset());
  return adjusted.toISOString().split('T')[0];
}

function normalizedValue(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

function formatTime12(time: string) {
  const [h = '0', m = '00'] = time.split(':');
  const date = new Date();
  date.setHours(Number(h), Number(m), 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function createTimeOptions(stepMinutes = 30) {
  const options: { value: string; label: string }[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const date = new Date();
    date.setHours(h, m, 0, 0);
    const label = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    options.push({ value, label });
  }
  return options;
}

const DEFAULT_ROLES = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];
const EDIT_INPUT_CLASS = 'w-full rounded-md border border-input bg-background px-2 py-1';
const TIME_OPTIONS = createTimeOptions();

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.isManager ?? false;

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [newShift, setNewShift] = useState({
    employee_id: '',
    date: getCurrentWeekStartISO(),
    start_time: '09:00',
    end_time: '17:00',
    role: 'Server',
  });
  const [creatingShift, setCreatingShift] = useState(false);

  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    employee_id: '',
    date: '',
    start_time: '',
    end_time: '',
    role: '',
  });

  const [employeeViewMode, setEmployeeViewMode] = useState<'weekly' | 'daily'>('weekly');
  const [selectedDay, setSelectedDay] = useState(toISODate(new Date()));

  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [claimingOpenShiftId, setClaimingOpenShiftId] = useState<number | null>(null);
  const [submittingShiftActionId, setSubmittingShiftActionId] = useState<number | null>(null);
  const [swapDraftShiftId, setSwapDraftShiftId] = useState<number | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapReason, setSwapReason] = useState('');

  const [draggedEmployeeId, setDraggedEmployeeId] = useState<number | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);

  const roleOptions = useMemo(() => {
    const roles = new Set<string>(DEFAULT_ROLES);
    employees.forEach((e) => roles.add(e.role));
    shifts.forEach((s) => roles.add(s.role));
    return Array.from(roles).sort((a, b) => a.localeCompare(b));
  }, [employees, shifts]);

  const selectedSchedule = useMemo(
    () => schedules.find((s) => s.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId],
  );

  const currentEmployee = useMemo(
    () => employees.find((e) => e.id === user?.employeeId) ?? null,
    [employees, user?.employeeId],
  );

  const currentEmployeeDepartment = normalizedValue(currentEmployee?.department);
  const currentEmployeeRole = normalizedValue(currentEmployee?.role ?? user?.employeeRole);

  const visibleShifts = useMemo(() => {
    const base = [...shifts].sort((a, b) => toSortableValue(a).localeCompare(toSortableValue(b)));
    if (isManager) return base;
    return base.filter((s) => s.employee_id === user?.employeeId);
  }, [shifts, isManager, user?.employeeId]);

  const weekMetadata = useMemo(() => {
    const anchor = selectedSchedule?.week_start
      ? new Date(`${selectedSchedule.week_start}T12:00:00`)
      : visibleShifts[0]?.date
        ? new Date(`${visibleShifts[0].date}T12:00:00`)
        : new Date();
    const weekStartDate = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartDate);
      d.setDate(weekStartDate.getDate() + i);
      return {
        date: toISODate(d),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });
    return {
      label: `${days[0].dayLabel} - ${days[6].dayLabel}`,
      weekStartISO: days[0].date,
      weekEndISO: days[6].date,
      days,
    };
  }, [selectedSchedule?.week_start, visibleShifts]);

  const scheduleDays = useMemo(() => {
    if (isManager || employeeViewMode === 'weekly') return weekMetadata.days;
    const d = new Date(`${selectedDay}T12:00:00`);
    return [{
      date: selectedDay,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }];
  }, [isManager, employeeViewMode, weekMetadata.days, selectedDay]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftWithEmployee[]>();
    visibleShifts.forEach((shift) => {
      const existing = map.get(shift.date);
      if (existing) {
        existing.push(shift);
      } else {
        map.set(shift.date, [shift]);
      }
    });
    return map;
  }, [visibleShifts]);

  const openShiftsByDate = useMemo(() => {
    const scopedOpenShifts = isManager
      ? openShifts
      : openShifts.filter((shift) => {
        const shiftDepartment = normalizedValue((shift as OpenShift & { department?: string | null }).department);
        if (currentEmployeeDepartment && shiftDepartment) {
          return shiftDepartment === currentEmployeeDepartment;
        }
        if (currentEmployeeRole) {
          return normalizedValue(shift.role) === currentEmployeeRole;
        }
        return true;
      });
    const map = new Map<string, OpenShift[]>();
    scopedOpenShifts.forEach((shift) => {
      const existing = map.get(shift.date);
      if (existing) {
        existing.push(shift);
      } else {
        map.set(shift.date, [shift]);
      }
    });
    return map;
  }, [openShifts, isManager, currentEmployeeDepartment, currentEmployeeRole]);

  const departmentTone = (department: string) => {
    const tones = [
      'border-blue-200 bg-blue-50/70',
      'border-purple-200 bg-purple-50/70',
      'border-emerald-200 bg-emerald-50/70',
      'border-amber-200 bg-amber-50/70',
      'border-cyan-200 bg-cyan-50/70',
      'border-rose-200 bg-rose-50/70',
    ];
    const key = (department || '').toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    return tones[Math.abs(hash) % tones.length];
  };

  const getShiftDisplayGroup = (shift: ShiftWithEmployee) =>
    shift.employee_department || shift.employee_role || shift.role;

  async function loadSchedules() {
    const list = await getSchedules();
    setSchedules(list);
    setSelectedScheduleId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev;
      return list.length > 0 ? list[0].id : null;
    });
  }

  async function loadShifts(scheduleId: number) {
    const list = await getScheduleShifts(scheduleId);
    setShifts(list);
  }

  async function loadOpenShifts() {
    const list = await getOpenShifts({
      status: 'open',
      date_from: weekMetadata.weekStartISO,
      date_to: weekMetadata.weekEndISO,
    });
    setOpenShifts(list);
  }

  useEffect(() => {
    Promise.all([loadSchedules(), getEmployees().then(setEmployees).catch(() => setEmployees([]))])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedScheduleId) {
      setShifts([]);
      return;
    }
    loadShifts(selectedScheduleId).catch(() => setShifts([]));
  }, [selectedScheduleId]);

  useEffect(() => {
    if (!selectedSchedule) return;
    setNewShift((prev) => ({ ...prev, date: selectedSchedule.week_start }));
    setSelectedDay(selectedSchedule.week_start);
  }, [selectedSchedule]);

  useEffect(() => {
    loadOpenShifts().catch(() => setOpenShifts([]));
  }, [weekMetadata.weekStartISO, weekMetadata.weekEndISO, selectedScheduleId]);

  async function handleTogglePublish() {
    if (!isManager || !selectedSchedule) return;
    const newStatus = selectedSchedule.status === 'published' ? 'draft' : 'published';
    try {
      await updateSchedule(selectedSchedule.id, { status: newStatus });
      await loadSchedules();
      toast(`Schedule ${newStatus === 'published' ? 'published' : 'set to draft'}.`, { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to update schedule status.', { variant: 'error' });
    }
  }

  async function handleDeleteSchedule() {
    if (!isManager || !selectedSchedule) return;
    if (!confirm('Delete this schedule and all shifts?')) return;
    try {
      await deleteSchedule(selectedSchedule.id);
      await loadSchedules();
      toast('Schedule deleted.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to delete schedule.', { variant: 'error' });
    }
  }

  async function handleCreateShift() {
    if (!isManager || !selectedScheduleId) return;
    if (!newShift.date || !newShift.start_time || !newShift.end_time || !newShift.role) {
      toast('Complete all shift fields before adding.', { variant: 'warning' });
      return;
    }
    if (newShift.end_time <= newShift.start_time) {
      toast('Shift end time must be after start time.', { variant: 'warning' });
      return;
    }
    setCreatingShift(true);
    try {
      if (newShift.employee_id) {
        await createShift({
          schedule_id: selectedScheduleId,
          employee_id: Number(newShift.employee_id),
          date: newShift.date,
          start_time: newShift.start_time,
          end_time: newShift.end_time,
          role: newShift.role,
        });
        await loadShifts(selectedScheduleId);
        toast('Shift added.', { variant: 'success' });
      } else {
        await createOpenShift({
          schedule_id: selectedScheduleId,
          date: newShift.date,
          start_time: newShift.start_time,
          end_time: newShift.end_time,
          role: newShift.role,
          reason: 'Unassigned shift',
        });
        await loadOpenShifts();
        toast('Open shift added.', { variant: 'success' });
      }
    } catch (err: any) {
      toast(err.message || 'Failed to add shift.', { variant: 'error' });
    } finally {
      setCreatingShift(false);
    }
  }

  async function handleCreateShiftFromDrag(date: string, employeeId: number) {
    if (!isManager || !selectedScheduleId) return;
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;
    try {
      await createShift({
        schedule_id: selectedScheduleId,
        employee_id: employeeId,
        date,
        start_time: newShift.start_time,
        end_time: newShift.end_time,
        role: employee.role || newShift.role,
      });
      await loadShifts(selectedScheduleId);
      toast(`Shift created for ${employee.name}.`, { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to create shift by drag/drop.', { variant: 'error' });
    }
  }

  function startEditing(shift: ShiftWithEmployee) {
    setEditingShiftId(shift.id);
    setEditForm({
      employee_id: shift.employee_id ? String(shift.employee_id) : '',
      date: shift.date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      role: shift.role,
    });
  }

  async function saveShiftEdit() {
    if (!isManager || !selectedScheduleId || !editingShiftId) return;
    if (!editForm.employee_id || !editForm.date || !editForm.start_time || !editForm.end_time || !editForm.role) {
      toast('Complete all shift fields before saving.', { variant: 'warning' });
      return;
    }
    if (editForm.end_time <= editForm.start_time) {
      toast('Shift end time must be after start time.', { variant: 'warning' });
      return;
    }
    try {
      await updateShift(editingShiftId, {
        employee_id: Number(editForm.employee_id),
        date: editForm.date,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        role: editForm.role,
      });
      setEditingShiftId(null);
      await loadShifts(selectedScheduleId);
      toast('Shift updated.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to update shift.', { variant: 'error' });
    }
  }

  async function handleDeleteShift(shiftId: number) {
    if (!isManager || !selectedScheduleId) return;
    if (!confirm('Delete this shift?')) return;
    try {
      await deleteShift(shiftId);
      await loadShifts(selectedScheduleId);
      toast('Shift deleted.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to delete shift.', { variant: 'error' });
    }
  }

  async function handleDropShift(shift: ShiftWithEmployee) {
    if (!selectedScheduleId || !user?.employeeId || shift.employee_id !== user.employeeId) return;
    const reason = prompt('Why are you dropping this shift?');
    if (reason === null) return;
    setSubmittingShiftActionId(shift.id);
    try {
      await dropShift(shift.id, reason.trim() || 'No reason provided');
      setSwapDraftShiftId(null);
      await Promise.all([loadShifts(selectedScheduleId), loadOpenShifts()]);
      toast('Shift drop request submitted.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to drop shift.', { variant: 'error' });
    } finally {
      setSubmittingShiftActionId(null);
    }
  }

  async function handleOfferOpenShift(openShiftId: number) {
    setClaimingOpenShiftId(openShiftId);
    try {
      await offerForOpenShift(openShiftId);
      await loadOpenShifts();
      toast('Pickup request submitted.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Unable to pick up this shift.', { variant: 'error' });
    } finally {
      setClaimingOpenShiftId(null);
    }
  }

  function beginSwapRequest(shiftId: number) {
    setSwapDraftShiftId(shiftId);
    setSwapReason('');
    setSwapTargetId('');
  }

  async function handleRequestSwap(shift: ShiftWithEmployee) {
    if (!selectedScheduleId || !user?.employeeId || shift.employee_id !== user.employeeId) return;
    if (!swapTargetId) {
      toast('Choose a teammate to swap with.', { variant: 'warning' });
      return;
    }
    setSubmittingShiftActionId(shift.id);
    try {
      await createSwap({
        shift_id: shift.id,
        requester_id: user.employeeId,
        target_id: Number(swapTargetId),
        reason: swapReason.trim() || undefined,
      });
      setSwapDraftShiftId(null);
      setSwapReason('');
      setSwapTargetId('');
      toast('Swap request sent.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to request swap.', { variant: 'error' });
    } finally {
      setSubmittingShiftActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading schedule…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Schedule"
        subtitle={isManager ? 'Build and publish shifts fast' : 'See your next shift instantly'}
        color="#0D9488"
        icon="📅"
      />

      <Card className="p-4 space-y-3">
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedules available yet.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Active Schedule</label>
              <select
                className={NATIVE_SELECT_CLASS}
                value={selectedScheduleId ?? ''}
                onChange={(e) => setSelectedScheduleId(Number(e.target.value))}
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    Week of {s.week_start} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            {isManager && selectedSchedule && (
              <>
                <Button variant="outline" onClick={handleTogglePublish}>
                  {selectedSchedule.status === 'published' ? 'Unpublish' : 'Publish'}
                </Button>
                <Button variant="destructive" onClick={handleDeleteSchedule}>Delete Schedule</Button>
              </>
            )}

            {!isManager && (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant={employeeViewMode === 'weekly' ? 'primary' : 'outline'}
                  onClick={() => setEmployeeViewMode('weekly')}
                >
                  Weekly
                </Button>
                <Button
                  size="sm"
                  variant={employeeViewMode === 'daily' ? 'primary' : 'outline'}
                  onClick={() => setEmployeeViewMode('daily')}
                >
                  Daily
                </Button>
                {employeeViewMode === 'daily' && (
                  <Input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {isManager && selectedScheduleId && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Quick Shift Creation</h2>
          <p className="text-xs text-muted-foreground">Pick role/time once, then drag employees into the schedule grid.</p>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Input label="Date" type="date" value={newShift.date} onChange={(e) => setNewShift((prev) => ({ ...prev, date: e.target.value }))} />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start</label>
              <select className={NATIVE_SELECT_CLASS} value={newShift.start_time} onChange={(e) => setNewShift((prev) => ({ ...prev, start_time: e.target.value }))}>
                {TIME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">End</label>
              <select className={NATIVE_SELECT_CLASS} value={newShift.end_time} onChange={(e) => setNewShift((prev) => ({ ...prev, end_time: e.target.value }))}>
                {TIME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                className={NATIVE_SELECT_CLASS}
                value={newShift.role}
                onChange={(e) => setNewShift((prev) => ({ ...prev, role: e.target.value }))}
              >
                {roleOptions.map((role) => <option key={role}>{role}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="new-shift-employee" className="text-xs font-medium text-muted-foreground">Assign Employee (optional)</label>
              <select
                id="new-shift-employee"
                className={NATIVE_SELECT_CLASS}
                value={newShift.employee_id}
                onChange={(e) => setNewShift((prev) => ({ ...prev, employee_id: e.target.value }))}
              >
                <option value="">Leave unassigned (open shift)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={handleCreateShift} isLoading={creatingShift}>
            {newShift.employee_id ? 'Add Shift' : 'Add Open Shift'}
          </Button>

          <div className="pt-2 border-t border-border space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Employee Roster (drag into a day)</h3>
            <div className="flex flex-wrap gap-2">
              {employees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  draggable
                  onDragStart={() => setDraggedEmployeeId(employee.id)}
                  onDragEnd={() => {
                    setDraggedEmployeeId(null);
                    setDropDate(null);
                  }}
                  className="rounded-md border border-border bg-background px-2 py-1 text-left text-xs"
                  title={`Drag to create a shift for ${employee.name}`}
                >
                  <div className="font-medium text-foreground">{employee.name}</div>
                  <div className="text-muted-foreground">{employee.role}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {isManager && editingShiftId && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Edit Shift</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input label="Date" type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start</label>
              <select className={NATIVE_SELECT_CLASS} value={editForm.start_time} onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))}>
                {TIME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">End</label>
              <select className={NATIVE_SELECT_CLASS} value={editForm.end_time} onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))}>
                {TIME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Employee</label>
              <select className={NATIVE_SELECT_CLASS} value={editForm.employee_id} onChange={(e) => setEditForm((p) => ({ ...p, employee_id: e.target.value }))}>
                <option value="" disabled hidden>Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select className={NATIVE_SELECT_CLASS} value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
                {roleOptions.map((role) => <option key={role}>{role}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveShiftEdit}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setEditingShiftId(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Week of {weekMetadata.label}</h2>
            <p className="text-xs text-muted-foreground">Clean schedule view with role color-coding and emphasized start times</p>
          </div>
          {!isManager && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" />
              Use <strong>Drop Shift</strong> or <strong>Swap Shift</strong> directly from your shifts
            </div>
          )}
        </div>

        <div className={`grid grid-cols-1 ${scheduleDays.length > 1 ? 'md:grid-cols-7' : ''} gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}>
          {scheduleDays.map((day) => (
            <div key={day.date} className="px-2 py-1">{day.weekday}</div>
          ))}
        </div>

        <div className={`grid grid-cols-1 ${scheduleDays.length > 1 ? 'md:grid-cols-7' : ''} gap-2`}>
          {scheduleDays.map((day) => {
            const dayShifts = shiftsByDate.get(day.date) ?? [];
            const dayOpenShifts = openShiftsByDate.get(day.date) ?? [];
            const isDropActive = isManager && dropDate === day.date;
            return (
              <div
                key={day.date}
                className={`rounded-xl border p-2 min-h-[190px] space-y-2 bg-card ${isDropActive ? 'border-primary border-2' : 'border-border'}`}
                onDragOver={(e) => {
                  if (!isManager || draggedEmployeeId == null) return;
                  e.preventDefault();
                  setDropDate(day.date);
                }}
                onDragLeave={() => {
                  if (dropDate === day.date) setDropDate(null);
                }}
                onDrop={async (e) => {
                  if (!isManager || draggedEmployeeId == null) return;
                  e.preventDefault();
                  setDropDate(null);
                  await handleCreateShiftFromDrag(day.date, draggedEmployeeId);
                  setDraggedEmployeeId(null);
                }}
              >
                <div className="text-xs font-semibold text-foreground">{day.dayLabel}</div>
                {dayShifts.map((shift) => {
                  const isOwnShift = !!user?.employeeId && shift.employee_id === user.employeeId;
                  const isSwapDraftOpen = swapDraftShiftId === shift.id;
                  const department = getShiftDisplayGroup(shift);
                  return (
                    <div key={shift.id} className={`rounded-lg border p-2 space-y-1 ${departmentTone(department)}`}>
                      <div className="text-xs text-foreground">
                        <span className="font-bold text-sm">{formatTime12(shift.start_time)}</span>
                        <span className="text-muted-foreground"> — {formatTime12(shift.end_time)}</span>
                      </div>
                      <div className="text-xs text-foreground">{shift.role}</div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{department}</div>
                      <div className="text-[11px] text-muted-foreground">{shift.employee_name || 'Unassigned'}</div>

                      {isManager && (
                        <div className="flex gap-1 pt-1">
                          <Button size="sm" variant="outline" onClick={() => startEditing(shift)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteShift(shift.id)}>Delete</Button>
                        </div>
                      )}

                      {!isManager && isOwnShift && (
                        <div className="space-y-2 pt-1">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDropShift(shift)}
                              isLoading={submittingShiftActionId === shift.id}
                            >
                              Drop Shift
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => beginSwapRequest(shift.id)}
                            >
                              Swap Shift
                            </Button>
                          </div>
                          {isSwapDraftOpen && (
                            <div className="space-y-1.5 rounded-md border border-border p-2">
                              <select
                                className={NATIVE_SELECT_CLASS}
                                value={swapTargetId}
                                onChange={(e) => setSwapTargetId(e.target.value)}
                              >
                                <option value="" disabled hidden>Select teammate</option>
                                {employees
                                  .filter((e) => e.id !== user?.employeeId)
                                  .map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                              </select>
                              <input
                                className={EDIT_INPUT_CLASS}
                                placeholder="Reason (optional)"
                                value={swapReason}
                                onChange={(e) => setSwapReason(e.target.value)}
                              />
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleRequestSwap(shift)}
                                  isLoading={submittingShiftActionId === shift.id}
                                >
                                  Send Swap
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setSwapDraftShiftId(null)}>Cancel</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {dayOpenShifts.map((openShift) => (
                  <div key={`open-${openShift.id}`} className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1">
                    <div className="text-xs text-foreground">
                      <span className="font-bold text-sm">{formatTime12(openShift.start_time)}</span>
                      <span className="text-muted-foreground"> — {formatTime12(openShift.end_time)}</span>
                    </div>
                    <div className="text-xs text-foreground">{openShift.role} (Open)</div>
                    {!isManager && (
                      <Button
                        size="sm"
                        onClick={() => handleOfferOpenShift(openShift.id)}
                        isLoading={claimingOpenShiftId === openShift.id}
                      >
                        Pickup Shift
                      </Button>
                    )}
                  </div>
                ))}

                {dayShifts.length === 0 && dayOpenShifts.length === 0 && (
                  <div className="pt-2 text-[11px] text-muted-foreground">No shifts</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

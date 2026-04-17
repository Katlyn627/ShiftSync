import { useEffect, useMemo, useState } from 'react';
import {
  createSwap,
  createShift,
  deleteSchedule,
  deleteShift,
  dropShift,
  Employee,
  generateSchedule,
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

const DEFAULT_ROLES = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];
const EDIT_INPUT_CLASS = 'w-full rounded-md border border-input bg-background px-2 py-1';

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.isManager ?? false;

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [weekStart, setWeekStart] = useState(getCurrentWeekStartISO());
  const [laborBudget, setLaborBudget] = useState(5000);
  const [generating, setGenerating] = useState(false);

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

  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [claimingOpenShiftId, setClaimingOpenShiftId] = useState<number | null>(null);
  const [submittingShiftActionId, setSubmittingShiftActionId] = useState<number | null>(null);
  const [swapDraftShiftId, setSwapDraftShiftId] = useState<number | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapReason, setSwapReason] = useState('');

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
    const base = [...shifts]
      .sort((a, b) => toSortableValue(a).localeCompare(toSortableValue(b)));
    if (isManager) return base;

    const departmentScoped = currentEmployeeDepartment
      ? base.filter((s) => normalizedValue(s.employee_department) === currentEmployeeDepartment)
      : base;

    if (!showOnlyMine) return departmentScoped;
    return departmentScoped.filter((s) => s.employee_id === user?.employeeId);
  }, [shifts, currentEmployeeDepartment, isManager, showOnlyMine, user?.employeeId]);

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
  }, [selectedSchedule]);

  useEffect(() => {
    if (isManager) {
      setOpenShifts([]);
      return;
    }
    getOpenShifts({
      status: 'open',
      date_from: weekMetadata.weekStartISO,
      date_to: weekMetadata.weekEndISO,
    }).then(setOpenShifts).catch(() => setOpenShifts([]));
  }, [isManager, weekMetadata.weekStartISO, weekMetadata.weekEndISO, selectedScheduleId]);

  async function handleGenerateSchedule() {
    if (!isManager) return;
    setGenerating(true);
    try {
      const schedule = await generateSchedule(weekStart, laborBudget);
      await loadSchedules();
      setSelectedScheduleId(schedule.id);
      toast('Schedule created.', { variant: 'success' });
    } catch (err: any) {
      toast(err.message || 'Failed to create schedule.', { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  }

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
    if (!newShift.employee_id || !newShift.date || !newShift.start_time || !newShift.end_time || !newShift.role) {
      toast('Complete all shift fields before adding.', { variant: 'warning' });
      return;
    }
    if (newShift.end_time <= newShift.start_time) {
      toast('Shift end time must be after start time.', { variant: 'warning' });
      return;
    }
    setCreatingShift(true);
    try {
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
    } catch (err: any) {
      toast(err.message || 'Failed to add shift.', { variant: 'error' });
    } finally {
      setCreatingShift(false);
    }
  }

  function startEditing(shift: ShiftWithEmployee) {
    setEditingShiftId(shift.id);
    setEditForm({
      employee_id: String(shift.employee_id),
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
      await Promise.all([
        loadShifts(selectedScheduleId),
        getOpenShifts({
          status: 'open',
          date_from: weekMetadata.weekStartISO,
          date_to: weekMetadata.weekEndISO,
        }).then(setOpenShifts).catch(() => setOpenShifts([])),
      ]);
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
      await getOpenShifts({
        status: 'open',
        date_from: weekMetadata.weekStartISO,
        date_to: weekMetadata.weekEndISO,
      }).then(setOpenShifts).catch(() => setOpenShifts([]));
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
        subtitle={isManager ? 'Create and manage weekly schedules' : 'View your upcoming shifts'}
        color="#0D9488"
        icon="📅"
      />

      <Card className="p-4 space-y-3">
        {isManager && (
          <div className="flex flex-wrap items-end gap-3 pb-2 border-b border-border">
            <Input label="Week Starting" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            <Input
              label="Labor Budget ($)"
              type="number"
              min={1000}
              step={250}
              value={laborBudget}
              onChange={(e) => setLaborBudget(Number(e.target.value))}
            />
            <Button onClick={handleGenerateSchedule} isLoading={generating}>Create Schedule</Button>
          </div>
        )}

        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedules yet. Managers can create one above.</p>
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
              <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showOnlyMine}
                  onChange={(e) => setShowOnlyMine(e.target.checked)}
                />
                Show only my shifts
              </label>
            )}
          </div>
        )}
      </Card>

      {isManager && selectedScheduleId && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Add Shift</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="new-shift-employee" className="text-xs font-medium text-muted-foreground">Employee</label>
              <select
                id="new-shift-employee"
                className={NATIVE_SELECT_CLASS}
                value={newShift.employee_id}
                onChange={(e) => setNewShift((prev) => ({ ...prev, employee_id: e.target.value }))}
              >
                <option value="" disabled hidden>Select employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <Input label="Date" type="date" value={newShift.date} onChange={(e) => setNewShift((prev) => ({ ...prev, date: e.target.value }))} />
            <Input label="Start" type="time" value={newShift.start_time} onChange={(e) => setNewShift((prev) => ({ ...prev, start_time: e.target.value }))} />
            <Input label="End" type="time" value={newShift.end_time} onChange={(e) => setNewShift((prev) => ({ ...prev, end_time: e.target.value }))} />
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
          </div>
          <Button onClick={handleCreateShift} isLoading={creatingShift}>Add Shift</Button>
        </Card>
      )}

      {isManager && editingShiftId && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Edit Shift</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input label="Date" type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} />
            <Input label="Start" type="time" value={editForm.start_time} onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))} />
            <Input label="End" type="time" value={editForm.end_time} onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))} />
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
            <p className="text-xs text-muted-foreground">Weekly schedule with department-scoped shift visibility</p>
          </div>
          {!isManager && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" />
              You can use <strong>Drop Shift</strong> and <strong>Swap Shift</strong> on your scheduled shifts
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {weekMetadata.days.map((day) => (
            <div key={day.date} className="px-2 py-1">{day.weekday}</div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {weekMetadata.days.map((day) => {
            const dayShifts = shiftsByDate.get(day.date) ?? [];
            const dayOpenShifts = !isManager ? openShiftsByDate.get(day.date) ?? [] : [];
            return (
              <div
                key={day.date}
                className="rounded-xl border p-2 min-h-[190px] space-y-2 bg-card border-border"
              >
                <div className="text-xs font-semibold text-foreground">{day.dayLabel}</div>
                    {dayShifts.map((shift) => {
                      const isOwnShift = !!user?.employeeId && shift.employee_id === user.employeeId;
                      const isSwapDraftOpen = swapDraftShiftId === shift.id;
                      const department = getShiftDisplayGroup(shift);
                      return (
                        <div key={shift.id} className={`rounded-lg border p-2 space-y-1 ${departmentTone(department)}`}>
                          <div className="text-xs font-semibold text-foreground">{shift.start_time} - {shift.end_time}</div>
                          <div className="text-xs text-foreground">{shift.role}</div>
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{department}</div>
                          <div className="text-[11px] text-muted-foreground">{shift.employee_name}</div>

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

                    {!isManager && dayOpenShifts.map((openShift) => (
                      <div key={`open-${openShift.id}`} className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1">
                        <div className="text-xs font-semibold text-foreground">{openShift.start_time} - {openShift.end_time}</div>
                        <div className="text-xs text-foreground">{openShift.role} (Open)</div>
                        <Button
                          size="sm"
                          onClick={() => handleOfferOpenShift(openShift.id)}
                          isLoading={claimingOpenShiftId === openShift.id}
                        >
                          Pickup Shift
                        </Button>
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

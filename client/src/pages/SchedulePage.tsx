import { useEffect, useMemo, useState } from 'react';
import {
  createShift,
  deleteSchedule,
  deleteShift,
  Employee,
  generateSchedule,
  getEmployees,
  getScheduleShifts,
  getSchedules,
  Schedule,
  ShiftWithEmployee,
  updateSchedule,
  updateShift,
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Input, NATIVE_SELECT_CLASS, PageHeader, useToast } from '../components/ui';

function weekStartDateISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function toSortableValue(shift: ShiftWithEmployee) {
  return `${shift.date} ${shift.start_time}`;
}

const DEFAULT_ROLES = ['Server', 'Kitchen', 'Bar', 'Host', 'Manager'];

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.isManager ?? false;

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [weekStart, setWeekStart] = useState(weekStartDateISO());
  const [laborBudget, setLaborBudget] = useState(5000);
  const [generating, setGenerating] = useState(false);

  const [newShift, setNewShift] = useState({
    employee_id: '',
    date: weekStartDateISO(),
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

  const [showOnlyMine, setShowOnlyMine] = useState(true);

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

  const visibleShifts = useMemo(() => {
    const base = [...shifts].sort((a, b) => toSortableValue(a).localeCompare(toSortableValue(b)));
    if (isManager || !showOnlyMine) return base;
    return base.filter((s) => s.employee_id === user?.employeeId);
  }, [shifts, isManager, showOnlyMine, user?.employeeId]);

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
    if (!newShift.employee_id) {
      toast('Select an employee first.', { variant: 'warning' });
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading schedule…</div>;
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
              <label className="text-xs font-medium text-muted-foreground">Employee</label>
              <select
                className={NATIVE_SELECT_CLASS}
                value={newShift.employee_id}
                onChange={(e) => setNewShift((prev) => ({ ...prev, employee_id: e.target.value }))}
              >
                <option value="">Select employee</option>
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

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
              {isManager && <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleShifts.map((shift) => {
              const editing = isManager && editingShiftId === shift.id;
              return (
                <tr key={shift.id} className="hover:bg-muted/20">
                  {editing ? (
                    <>
                      <td className="px-4 py-2"><input className="w-full rounded-md border border-input bg-background px-2 py-1" type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} /></td>
                      <td className="px-4 py-2 flex gap-2">
                        <input className="w-full rounded-md border border-input bg-background px-2 py-1" type="time" value={editForm.start_time} onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))} />
                        <input className="w-full rounded-md border border-input bg-background px-2 py-1" type="time" value={editForm.end_time} onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))} />
                      </td>
                      <td className="px-4 py-2">
                        <select className={NATIVE_SELECT_CLASS} value={editForm.employee_id} onChange={(e) => setEditForm((p) => ({ ...p, employee_id: e.target.value }))}>
                          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select className={NATIVE_SELECT_CLASS} value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
                          {roleOptions.map((role) => <option key={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <Button size="sm" onClick={saveShiftEdit}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingShiftId(null)}>Cancel</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">{shift.date}</td>
                      <td className="px-4 py-3">{shift.start_time} - {shift.end_time}</td>
                      <td className="px-4 py-3">{shift.employee_name}</td>
                      <td className="px-4 py-3">{shift.role}</td>
                      {isManager && (
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => startEditing(shift)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteShift(shift.id)}>Delete</Button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleShifts.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No shifts to display.
          </div>
        )}
      </Card>
    </div>
  );
}

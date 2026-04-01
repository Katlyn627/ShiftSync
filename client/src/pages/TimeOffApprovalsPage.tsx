import { useCallback, useEffect, useState } from 'react';
import {
  getTimeOffRequests, approveTimeOffRequest, rejectTimeOffRequest, cancelTimeOffRequest,
  TimeOffRequest,
} from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Badge, PageHeader } from '../components/ui';

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function TimeOffApprovalsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notes, setNotes]       = useState<Record<number, string>>({});
  const [acting, setActing]     = useState<number | null>(null);
  const [filter, setFilter]     = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const load = useCallback(async () => {
    try {
      const all = await getTimeOffRequests();
      setRequests(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!user?.isManager) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
        <p className="text-sm font-semibold text-foreground">Access Denied</p>
        <p className="text-xs text-muted-foreground">Only managers can view this page.</p>
      </div>
    );
  }

  const handleApprove = async (id: number) => {
    setActing(id);
    try {
      await approveTimeOffRequest(id, notes[id] || undefined);
      await load();
    } catch (err: any) {
      alert('Error approving request: ' + err.message);
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: number) => {
    setActing(id);
    try {
      await rejectTimeOffRequest(id, notes[id] || undefined);
      await load();
    } catch (err: any) {
      alert('Error rejecting request: ' + err.message);
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this time-off request?')) return;
    setActing(id);
    try {
      await cancelTimeOffRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert('Error deleting request: ' + err.message);
    } finally {
      setActing(null);
    }
  };

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading requests…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <PageHeader
        title="Time-Off Approvals"
        subtitle="Review and approve or deny employee time-off requests"
        color="#059669"
        icon="🌿"
        actions={pendingCount > 0
          ? <Badge variant="warning">{pendingCount} pending</Badge>
          : undefined}
      />

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
              filter === f
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-semibold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Requests list ── */}
      {filtered.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <svg className="w-8 h-8 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <p className="text-sm font-medium text-muted-foreground">No {filter !== 'all' ? filter : ''} requests</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start gap-4">
                {/* Employee info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{r.employee_name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">Dates:</span>{' '}
                    {r.start_date} → {r.end_date}
                  </p>
                  {r.reason && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground">Reason:</span>{' '}
                      {r.reason}
                    </p>
                  )}
                  {r.manager_notes && (
                    <p className="text-sm text-muted-foreground mt-0.5 italic">
                      <span className="font-medium text-foreground not-italic">Note:</span>{' '}
                      {r.manager_notes}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col gap-2 items-end">
                  {r.status === 'pending' && (
                    <>
                      <textarea
                        className="text-xs border border-border rounded-md px-2 py-1.5 w-48 resize-none bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        rows={2}
                        placeholder="Manager notes (optional)…"
                        value={notes[r.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                      />
                      <div className="flex gap-1.5">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(r.id)}
                          disabled={acting === r.id}
                          isLoading={acting === r.id}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(r.id)}
                          disabled={acting === r.id}
                        >
                          Deny
                        </Button>
                      </div>
                    </>
                  )}
                  {r.status !== 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(r.id)}
                      disabled={acting === r.id}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

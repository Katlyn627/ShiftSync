import { useEffect, useState } from 'react';
import { getSwaps, approveSwap, rejectSwap, SwapWithDetails } from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Badge, Input } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
  };
  return map[status] ?? 'default';
}

export default function SwapsPage() {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState<SwapWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = () => getSwaps().then(s => { setSwaps(s); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleApprove = async (id: number) => {
    await approveSwap(id, notes[id]);
    load();
  };
  const handleReject = async (id: number) => {
    await rejectSwap(id, notes[id]);
    load();
  };

  if (loading) return <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>;

  // Employees only see their own swap requests; managers see all
  const visibleSwaps = user?.isManager
    ? swaps
    : swaps.filter(s => s.requester_id === user?.employeeId || s.target_id === user?.employeeId);
  const pending = visibleSwaps.filter(s => s.status === 'pending');
  const resolved = visibleSwaps.filter(s => s.status !== 'pending');

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">Shift Swaps</h1>

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-2">⏳ Pending ({pending.length})</h2>
          <div className="space-y-3">
            {pending.map(swap => (
              <SwapCard
                key={swap.id}
                swap={swap}
                notes={notes[swap.id] ?? ''}
                onNotesChange={v => setNotes(n => ({ ...n, [swap.id]: v }))}
                onApprove={user?.isManager ? () => handleApprove(swap.id) : undefined}
                onReject={user?.isManager ? () => handleReject(swap.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-2">History</h2>
          <div className="space-y-2">
            {resolved.map(swap => (
              <SwapCard key={swap.id} swap={swap} notes="" onNotesChange={() => {}} />
            ))}
          </div>
        </div>
      )}

      {visibleSwaps.length === 0 && (
        <div className="text-center py-20 text-muted-foreground/70">
          <p className="text-lg">No shift swap requests yet.</p>
          <p className="text-sm mt-1">To request a swap, go to the <strong>Schedule</strong> page, find your shift, and click <strong>"Request Swap"</strong>.</p>
        </div>
      )}
    </div>
  );
}

function SwapCard({
  swap, notes, onNotesChange, onApprove, onReject
}: {
  swap: SwapWithDetails;
  notes: string;
  onNotesChange: (v: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={statusVariant(swap.status)}>{swap.status.toUpperCase()}</Badge>
            <span className="text-xs text-muted-foreground/70">{new Date(swap.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-sm">
            <span className="font-semibold">{swap.requester_name}</span> wants to swap their{' '}
            <span className="font-semibold">{swap.shift_role}</span> shift on{' '}
            <span className="font-semibold">{swap.shift_date}</span>{' '}
            ({swap.start_time}–{swap.end_time})
            {swap.target_name && (
              <> with <span className="font-semibold">{swap.target_name}</span></>
            )}
          </p>
          {swap.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {swap.reason}</p>}
          {swap.manager_notes && <p className="text-xs text-primary mt-1">Notes: {swap.manager_notes}</p>}
        </div>
        {swap.status === 'pending' && onApprove && onReject && (
          <div className="flex flex-col gap-2 min-w-[200px]">
            <Input
              placeholder="Manager notes (optional)"
              value={notes}
              onChange={e => onNotesChange(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="default" size="sm" className="flex-1" onClick={onApprove}>✓ Approve</Button>
              <Button variant="destructive" size="sm" className="flex-1" onClick={onReject}>✗ Reject</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
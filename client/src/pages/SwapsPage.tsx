import { useEffect, useState } from 'react';
import { getSwaps, approveSwap, rejectSwap, SwapWithDetails } from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Badge, Input } from '../components/ui';
import type { BadgeVariant } from '../components/ui';

function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = { pending: 'warning', approved: 'success', rejected: 'danger' };
  return map[status] ?? 'default';
}

export default function SwapsPage() {
  const { user }  = useAuth();
  const [swaps, setSwaps]     = useState<SwapWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes]     = useState<Record<number, string>>({});

  const load = () => getSwaps().then(s => { setSwaps(s); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleApprove = async (id: number) => { await approveSwap(id, notes[id]); load(); };
  const handleReject  = async (id: number) => { await rejectSwap(id, notes[id]);  load(); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading swap requests…
      </div>
    );
  }

  const visibleSwaps = user?.isManager
    ? swaps
    : swaps.filter(s => s.requester_id === user?.employeeId || s.target_id === user?.employeeId);
  const pending  = visibleSwaps.filter(s => s.status === 'pending');
  const resolved = visibleSwaps.filter(s => s.status !== 'pending');

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Shift Swaps</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending.length > 0
              ? `${pending.length} pending request${pending.length > 1 ? 's' : ''} awaiting review`
              : 'No pending swap requests'}
          </p>
        </div>
        {pending.length > 0 && (
          <Badge variant="warning" className="text-sm px-3 py-1">{pending.length} Pending</Badge>
        )}
      </div>

      {/* ── Pending ── */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Pending ({pending.length})
          </h2>
          {pending.map(swap => (
            <SwapCard
              key={swap.id}
              swap={swap}
              notes={notes[swap.id] ?? ''}
              onNotesChange={v => setNotes(n => ({ ...n, [swap.id]: v }))}
              onApprove={user?.isManager ? () => handleApprove(swap.id) : undefined}
              onReject={user?.isManager  ? () => handleReject(swap.id)  : undefined}
            />
          ))}
        </div>
      )}

      {/* ── History ── */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</h2>
          {resolved.map(swap => (
            <SwapCard key={swap.id} swap={swap} notes="" onNotesChange={() => {}} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {visibleSwaps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center bg-white rounded-xl border border-border">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M4 6h16M4 6l4-4M4 6l4 4"/><path d="M20 18H4M20 18l-4-4M20 18l-4 4"/>
            </svg>
          </div>
          <p className="font-semibold text-foreground">No swap requests yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            To request a swap, go to the <strong>Schedule</strong> page, find your shift, and click "Swap".
          </p>
        </div>
      )}

    </div>
  );
}

function SwapCard({
  swap, notes, onNotesChange, onApprove, onReject,
}: {
  swap: SwapWithDetails;
  notes: string;
  onNotesChange: (v: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const isPending = swap.status === 'pending';
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Swap details */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariant(swap.status)}>{swap.status.toUpperCase()}</Badge>
            <span className="text-xs text-muted-foreground">{new Date(swap.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-semibold">{swap.requester_name}</span> wants to swap their{' '}
            <span className="font-semibold">{swap.shift_role}</span> shift on{' '}
            <span className="font-semibold">{swap.shift_date}</span>{' '}
            <span className="text-muted-foreground">({swap.start_time}–{swap.end_time})</span>
            {swap.target_name && (
              <> with <span className="font-semibold">{swap.target_name}</span></>
            )}
          </p>
          {swap.reason && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5 inline-block">
              Reason: {swap.reason}
            </p>
          )}
          {swap.manager_notes && (
            <p className="text-xs text-primary bg-primary/5 rounded-lg px-3 py-1.5 inline-block">
              Manager note: {swap.manager_notes}
            </p>
          )}
        </div>

        {/* Manager actions */}
        {isPending && onApprove && onReject && (
          <div className="flex flex-col gap-2 min-w-[200px]">
            <Input
              placeholder="Manager notes (optional)"
              value={notes}
              onChange={e => onNotesChange(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="default"     size="sm" className="flex-1" onClick={onApprove}>
                Approve
              </Button>
              <Button variant="destructive" size="sm" className="flex-1" onClick={onReject}>
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

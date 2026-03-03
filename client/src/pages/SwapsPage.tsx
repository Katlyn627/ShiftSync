import { useEffect, useState } from 'react';
import { getSwaps, approveSwap, rejectSwap, SwapWithDetails } from '../api';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function SwapsPage() {
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

  if (loading) return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;

  const pending = swaps.filter(s => s.status === 'pending');
  const resolved = swaps.filter(s => s.status !== 'pending');

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">Shift Swaps</h1>

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">⏳ Pending ({pending.length})</h2>
          <div className="space-y-3">
            {pending.map(swap => (
              <SwapCard
                key={swap.id}
                swap={swap}
                notes={notes[swap.id] ?? ''}
                onNotesChange={v => setNotes(n => ({ ...n, [swap.id]: v }))}
                onApprove={() => handleApprove(swap.id)}
                onReject={() => handleReject(swap.id)}
              />
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">History</h2>
          <div className="space-y-2">
            {resolved.map(swap => (
              <SwapCard key={swap.id} swap={swap} notes="" onNotesChange={() => {}} />
            ))}
          </div>
        </div>
      )}

      {swaps.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No shift swap requests yet.</p>
          <p className="text-sm mt-1">Swap requests will appear here for manager approval.</p>
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
    <div className="bg-white rounded-xl border shadow-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[swap.status]}`}>
              {swap.status.toUpperCase()}
            </span>
            <span className="text-xs text-gray-400">{new Date(swap.created_at).toLocaleDateString()}</span>
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
          {swap.reason && <p className="text-xs text-gray-500 mt-1">Reason: {swap.reason}</p>}
          {swap.manager_notes && <p className="text-xs text-blue-600 mt-1">Notes: {swap.manager_notes}</p>}
        </div>
        {swap.status === 'pending' && onApprove && onReject && (
          <div className="flex flex-col gap-2 min-w-[200px]">
            <input
              type="text"
              placeholder="Manager notes (optional)"
              className="border rounded px-2 py-1 text-xs"
              value={notes}
              onChange={e => onNotesChange(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={onApprove} className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700">
                ✓ Approve
              </button>
              <button onClick={onReject} className="flex-1 bg-red-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-600">
                ✗ Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

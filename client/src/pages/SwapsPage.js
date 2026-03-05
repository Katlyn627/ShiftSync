import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getSwaps, approveSwap, rejectSwap } from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Badge, Input } from '../components/ui';
function statusVariant(status) {
    const map = { pending: 'warning', approved: 'success', rejected: 'danger' };
    return map[status] ?? 'default';
}
export default function SwapsPage() {
    const { user } = useAuth();
    const [swaps, setSwaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState({});
    const load = () => getSwaps().then(s => { setSwaps(s); setLoading(false); });
    useEffect(() => { load(); }, []);
    const handleApprove = async (id) => { await approveSwap(id, notes[id]); load(); };
    const handleReject = async (id) => { await rejectSwap(id, notes[id]); load(); };
    if (loading) {
        return (_jsxs("div", { className: "flex items-center justify-center py-24 text-muted-foreground text-sm", children: [_jsxs("svg", { className: "w-4 h-4 animate-spin mr-2", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8v8z" })] }), "Loading swap requests\u2026"] }));
    }
    const visibleSwaps = user?.isManager
        ? swaps
        : swaps.filter(s => s.requester_id === user?.employeeId || s.target_id === user?.employeeId);
    const pending = visibleSwaps.filter(s => s.status === 'pending');
    const resolved = visibleSwaps.filter(s => s.status !== 'pending');
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-foreground", children: "Shift Swaps" }), _jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: pending.length > 0
                                    ? `${pending.length} pending request${pending.length > 1 ? 's' : ''} awaiting review`
                                    : 'No pending swap requests' })] }), pending.length > 0 && (_jsxs(Badge, { variant: "warning", className: "text-sm px-3 py-1", children: [pending.length, " Pending"] }))] }), pending.length > 0 && (_jsxs("div", { className: "space-y-3", children: [_jsxs("h2", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider", children: ["Pending (", pending.length, ")"] }), pending.map(swap => (_jsx(SwapCard, { swap: swap, notes: notes[swap.id] ?? '', onNotesChange: v => setNotes(n => ({ ...n, [swap.id]: v })), onApprove: user?.isManager ? () => handleApprove(swap.id) : undefined, onReject: user?.isManager ? () => handleReject(swap.id) : undefined }, swap.id)))] })), resolved.length > 0 && (_jsxs("div", { className: "space-y-3", children: [_jsx("h2", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider", children: "History" }), resolved.map(swap => (_jsx(SwapCard, { swap: swap, notes: "", onNotesChange: () => { } }, swap.id)))] })), visibleSwaps.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center py-24 gap-3 text-center bg-white rounded-xl border border-border", children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground", children: _jsxs("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", strokeWidth: "1.5", viewBox: "0 0 24 24", children: [_jsx("path", { d: "M4 6h16M4 6l4-4M4 6l4 4" }), _jsx("path", { d: "M20 18H4M20 18l-4-4M20 18l-4 4" })] }) }), _jsx("p", { className: "font-semibold text-foreground", children: "No swap requests yet" }), _jsxs("p", { className: "text-sm text-muted-foreground max-w-xs", children: ["To request a swap, go to the ", _jsx("strong", { children: "Schedule" }), " page, find your shift, and click \"Swap\"."] })] }))] }));
}
function SwapCard({ swap, notes, onNotesChange, onApprove, onReject, }) {
    const isPending = swap.status === 'pending';
    return (_jsx(Card, { className: "p-5", children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0 space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx(Badge, { variant: statusVariant(swap.status), children: swap.status.toUpperCase() }), _jsx("span", { className: "text-xs text-muted-foreground", children: new Date(swap.created_at).toLocaleDateString() })] }), _jsxs("p", { className: "text-sm text-foreground leading-relaxed", children: [_jsx("span", { className: "font-semibold", children: swap.requester_name }), " wants to swap their", ' ', _jsx("span", { className: "font-semibold", children: swap.shift_role }), " shift on", ' ', _jsx("span", { className: "font-semibold", children: swap.shift_date }), ' ', _jsxs("span", { className: "text-muted-foreground", children: ["(", swap.start_time, "\u2013", swap.end_time, ")"] }), swap.target_name && (_jsxs(_Fragment, { children: [" with ", _jsx("span", { className: "font-semibold", children: swap.target_name })] }))] }), swap.reason && (_jsxs("p", { className: "text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5 inline-block", children: ["Reason: ", swap.reason] })), swap.manager_notes && (_jsxs("p", { className: "text-xs text-primary bg-primary/5 rounded-lg px-3 py-1.5 inline-block", children: ["Manager note: ", swap.manager_notes] }))] }), isPending && onApprove && onReject && (_jsxs("div", { className: "flex flex-col gap-2 min-w-[200px]", children: [_jsx(Input, { placeholder: "Manager notes (optional)", value: notes, onChange: e => onNotesChange(e.target.value) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "default", size: "sm", className: "flex-1", onClick: onApprove, children: "Approve" }), _jsx(Button, { variant: "destructive", size: "sm", className: "flex-1", onClick: onReject, children: "Reject" })] })] }))] }) }));
}

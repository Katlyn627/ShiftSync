import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import {
  getConversations, getConversationMessages, sendMessage, createConversation,
  markConversationRead, getEmployees,
  ConversationWithDetails, ConversationMember, Message, Employee,
} from '../api';
import { PageHeader, Button, Input, Card } from '../components/ui';

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationTitle(conv: ConversationWithDetails, currentEmployeeId: number | null): string {
  if (conv.title) return conv.title;
  if (conv.type === 'direct') {
    const other = conv.members?.find(m => m.id !== currentEmployeeId);
    return other?.name ?? 'Direct Message';
  }
  return conv.members?.map(m => m.name).join(', ') ?? 'Group Chat';
}

export default function MessagingPage() {
  const MESSAGE_POLL_INTERVAL_MS = 5000;
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const convs = await getConversations();
      setConversations(convs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    getEmployees().then(setEmployees).catch(() => {});
  }, [loadConversations]);

  // Poll for new messages every 5 seconds when a conversation is selected
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (selectedId) {
      pollRef.current = setInterval(async () => {
        try {
          const data = await getConversationMessages(selectedId);
          setMessages(data.messages);
          setMembers(data.members);
          loadConversations();
        } catch { /* ignore */ }
      }, MESSAGE_POLL_INTERVAL_MS);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId, loadConversations]);

  async function openConversation(id: number) {
    setSelectedId(id);
    setError(null);
    try {
      const data = await getConversationMessages(id);
      setMessages(data.messages);
      setMembers(data.members);
      await markConversationRead(id);
      await loadConversations();
    } catch (e: any) {
      setError(e.message);
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    try {
      const msg = await sendMessage(selectedId, newMessage.trim());
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
      await loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleStartChat() {
    if (selectedEmployees.length === 0) return;
    const type = selectedEmployees.length === 1 ? 'direct' : 'group';
    try {
      const conv = await createConversation({
        member_ids: selectedEmployees,
        type,
        title: type === 'group' && groupTitle ? groupTitle : undefined,
      });
      setShowNewChat(false);
      setSelectedEmployees([]);
      setGroupTitle('');
      setEmployeeSearch('');
      await loadConversations();
      openConversation(conv.id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const selectedConv = conversations.find(c => c.id === selectedId);
  const currentEmpId = user?.employeeId ?? null;
  const filteredEmployees = employees.filter(e =>
    e.id !== currentEmpId &&
    e.name.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages"
        subtitle="Chat with your team members and manager"
        color="#8B5CF6"
        icon="💬"
        actions={
          <Button size="sm" onClick={() => setShowNewChat(true)}>
            + New Chat
          </Button>
        }
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
        {/* Conversation list */}
        <div className="w-72 shrink-0 flex flex-col gap-1 overflow-y-auto">
          {loading ? (
            <div className="text-center text-muted-foreground text-sm py-8">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No conversations yet. Start one with a team member!
            </div>
          ) : (
            conversations.map(conv => {
              const title = ConversationTitle(conv, currentEmpId);
              const isSelected = conv.id === selectedId;
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-violet-100 dark:bg-violet-900/30 ring-1 ring-violet-300'
                      : 'hover:bg-muted/60'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                    style={{ background: conv.type === 'group' ? '#8B5CF6' : '#6366F1' }}
                  >
                    {conv.type === 'group' ? '👥' : getInitials(title)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold truncate">{title}</span>
                      {conv.unread_count > 0 && (
                        <span className="shrink-0 w-4 h-4 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Message thread */}
        <div className="flex-1 flex flex-col border rounded-2xl bg-background overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
              <span className="text-4xl">💬</span>
              <p>Select a conversation to start chatting</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: selectedConv?.type === 'group' ? '#8B5CF6' : '#6366F1' }}
                >
                  {selectedConv?.type === 'group' ? '👥' : getInitials(ConversationTitle(selectedConv!, currentEmpId))}
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedConv ? ConversationTitle(selectedConv, currentEmpId) : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    {members.map(m => m.name).join(', ')}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No messages yet. Say hello! 👋
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_id === currentEmpId;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                          style={{ background: isMe ? '#8B5CF6' : '#6366F1' }}
                        >
                          {getInitials(msg.sender_name)}
                        </div>
                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                          {!isMe && (
                            <span className="text-[11px] text-muted-foreground px-1">{msg.sender_name}</span>
                          )}
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm leading-snug break-words ${
                              isMe
                                ? 'bg-violet-500 text-white rounded-br-sm'
                                : 'bg-muted rounded-bl-sm'
                            }`}
                          >
                            {msg.body}
                          </div>
                          <span className="text-[10px] text-muted-foreground px-1">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <form onSubmit={handleSend} className="px-4 py-3 border-t flex gap-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !newMessage.trim()}>
                  {sending ? '…' : 'Send'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md mx-4 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg">Start a New Chat</h2>
              <button
                onClick={() => { setShowNewChat(false); setSelectedEmployees([]); setEmployeeSearch(''); setGroupTitle(''); }}
                className="text-muted-foreground hover:text-foreground text-xl"
              >
                ✕
              </button>
            </div>

            <Input
              placeholder="Search team members…"
              value={employeeSearch}
              onChange={e => setEmployeeSearch(e.target.value)}
            />

            <div className="space-y-1 max-h-52 overflow-y-auto">
              {filteredEmployees.map(emp => (
                <label key={emp.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={e => {
                      setSelectedEmployees(prev =>
                        e.target.checked ? [...prev, emp.id] : prev.filter(id => id !== emp.id)
                      );
                    }}
                    className="accent-violet-500"
                  />
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ background: '#6366F1' }}
                  >
                    {getInitials(emp.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.role}</p>
                  </div>
                </label>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No employees found</p>
              )}
            </div>

            {selectedEmployees.length > 1 && (
              <Input
                placeholder="Group name (optional)"
                value={groupTitle}
                onChange={e => setGroupTitle(e.target.value)}
              />
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowNewChat(false); setSelectedEmployees([]); setEmployeeSearch(''); setGroupTitle(''); }}>
                Cancel
              </Button>
              <Button onClick={handleStartChat} disabled={selectedEmployees.length === 0}>
                Start Chat {selectedEmployees.length > 0 && `(${selectedEmployees.length})`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

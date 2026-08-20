import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useCanWrite } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { SelectInput } from "@/components/app/forms";
import { fmtRelative } from "@/lib/dates";
import { MessageSquare, Send, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Conversation = any;
type Message = any;

export default function Messages() {
  const canWrite = useCanWrite();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const conversations = useQuery(api.messages.listConversations, {});
  const messages = useQuery(api.messages.getConversation, selectedId ? { id: selectedId as any } : "skip");
  const markRead = useMutation(api.messages.markConversationRead);
  const sendMessage = useMutation(api.messages.sendMessage);

  const [replyBody, setReplyBody] = useState("");
  const [replyChannel, setReplyChannel] = useState("internal");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"" | "urgent" | "high" | "normal">("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSend = async () => {
    if (!selectedId || !replyBody.trim()) return;
    try {
      await sendMessage({ conversationId: selectedId as any, body: replyBody.trim(), direction: "out", channel: replyChannel as any });
      setReplyBody("");
      toast.success("Message sent.");
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    const conv = conversations?.find((c) => c._id === id);
    if (conv && conv.unread > 0) {
      try { await markRead({ conversationId: id as any }); } catch { /* noop */ }
    }
  };

  const selectedConvo = conversations?.find((c: any) => c._id === selectedId);

  if (selectedConvo && messages) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}><ArrowLeft className="size-4" /></Button>
          <div>
            <h1 className="text-lg font-semibold">{selectedConvo.title}</h1>
            <p className="text-xs text-muted-foreground">{selectedConvo.entityType} · {selectedConvo.messageCount} messages</p>
          </div>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto rounded-lg border p-4">
          {messages.messages.map((m) => (
            <div key={m._id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[75%] rounded-lg px-4 py-3", m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {m.subject && <p className="text-xs font-semibold mb-1 opacity-80">{m.subject}</p>}
                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] opacity-70">{m.senderName ?? (m.direction === "out" ? "You" : "Incoming")} · {fmtRelative(m._creationTime)}</span>
                  {m.priority === "urgent" && <AlertTriangle className="size-3 text-red-400" />}
                  {m.aiCategory && <Badge variant="outline" className="text-[10px] opacity-70">{m.aiCategory}</Badge>}
                </div>
              </div>
            </div>
          ))}
          {messages.messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>}
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <SelectInput value={replyChannel} onChange={(e) => setReplyChannel(e.target.value)} className="w-32">
              <option value="internal">Internal</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </SelectInput>
            <input value={replyBody} onChange={(e) => setReplyBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Type a message…" className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
            <Button size="sm" onClick={handleSend} disabled={!replyBody.trim()} className="gap-1.5"><Send className="size-3.5" /> Send</Button>
          </div>
        )}
      </div>
    );
  }

  const filteredConversations = (conversations ?? []).filter((c: Conversation) => {
    const matchesSearch = !debouncedSearch ||
      c.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      c.lastMessagePreview?.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesPriority = !priorityFilter ||
      (priorityFilter === "urgent" && c.urgent > 0) ||
      (priorityFilter === "high" && c.urgent > 0);
    return matchesSearch && matchesPriority;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description={`${conversations?.length ?? 0} conversations`} />
      {conversations === undefined ? <LoadingState /> : (
        conversations.length === 0 ? <EmptyState icon={<MessageSquare className="size-6" />} title="No conversations" description="Conversations are created when you add brokers, carriers, or drivers." /> : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">All priorities</option>
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟡 High</option>
              </select>
            </div>
            <div className="space-y-1">
              {filteredConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No conversations match your search.</p>
              ) : (
                filteredConversations.map((c) => (
                  <button key={c._id} onClick={() => handleSelect(c._id)} className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        {c.unread > 0 && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-transparent text-[10px]">{c.unread} unread</Badge>}
                        {c.urgent > 0 && <Badge variant="outline" className="bg-red-500/10 text-red-600 border-transparent text-[10px]">{c.urgent} urgent</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessagePreview || "No messages"}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{c.lastMessageAt ? fmtRelative(c.lastMessageAt) : ""}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

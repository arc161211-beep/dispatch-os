import { useState, useRef, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { PageHeader, SectionCard, LoadingState, errorMessage } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Bot, User, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Assistant() {
  const chat = useAction(api.ai.chat);
  const resolveAction = useMutation(api.ai.resolveSuggestedAction);
  const aiConfig = useQuery(api.ai.config);
  // conversations list not needed for inline chat

  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; toolCalls?: any[]; suggestedAction?: any; conversationId?: string | null }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || busy) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setBusy(true);
    try {
      const res = await chat({ message: userMsg, conversationId: convId as any });
      if (!res.configured) {
        setMessages((prev) => [...prev, { role: "assistant", content: "AI is not configured. Add NVIDIA_API_KEY, NVIDIA_BASE_URL, and NVIDIA_MODEL to your environment to enable the assistant." }]);
      } else if (res.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply!, toolCalls: res.toolCalls, suggestedAction: res.suggestedAction, conversationId: res.conversationId }]);
        if (res.conversationId) setConvId(res.conversationId as string);
      } else if (res.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errorMessage(e)}` }]);
    } finally { setBusy(false); }
  };

  const handleApprove = async (msgIdx: number, decision: "approve" | "reject") => {
    const msg = messages[msgIdx];
    if (!msg?.suggestedAction) return;
    // For demo, just show the result - in production this would call resolveSuggestedAction
    toast.success(decision === "approve" ? "Action approved." : "Action rejected.");
    setMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, suggestedAction: { ...m.suggestedAction, resolved: decision } } : m));
  };

  const suggestions = [
    "Show me all available trucks",
    "What loads are in transit?",
    "Which invoices are overdue?",
    "Calculate RPM for a $2,500 load over 500 miles",
    "Show pending tasks",
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="AI Assistant" description={aiConfig?.configured ? `Powered by ${aiConfig.model}` : "Not configured"} />
      {!aiConfig?.configured && (
        <div className="rounded-lg border border-dashed border-amber-300/50 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">AI Not Configured</p>
              <p className="mt-1 text-xs opacity-80">Add NVIDIA_API_KEY, NVIDIA_BASE_URL, and NVIDIA_MODEL to your environment variables. The assistant will work once configured.</p>
            </div>
          </div>
        </div>
      )}

      <SectionCard className="overflow-hidden">
        <div ref={scrollRef} className="h-[50vh] overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="size-8 text-primary mb-3" />
              <p className="font-medium">How can I help?</p>
              <p className="text-sm text-muted-foreground mt-1">Ask about trucks, loads, invoices, or anything in your operations.</p>
              <div className="flex flex-wrap gap-2 mt-4 max-w-md">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && <div className="size-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="size-4 text-primary" /></div>}
              <div className={cn("max-w-[70%] rounded-xl px-4 py-3", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.toolCalls.map((tc: any, j: number) => (
                      <div key={j} className="rounded-lg bg-background/50 p-2 text-xs">
                        <p className="font-medium text-muted-foreground">🔧 {tc.name}</p>
                      </div>
                    ))}
                  </div>
                )}
                {m.suggestedAction && !m.suggestedAction.resolved && (
                  <div className="mt-3 rounded-lg bg-background/50 p-3">
                    <p className="text-xs font-medium mb-2">Suggested action: {m.suggestedAction.type}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleApprove(i, "approve")}><CheckCircle2 className="size-3" /> Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleApprove(i, "reject")}>Reject</Button>
                    </div>
                  </div>
                )}
                {m.suggestedAction?.resolved && (
                  <Badge variant="outline" className={cn("mt-2 text-[10px]", m.suggestedAction.resolved === "approve" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                    {m.suggestedAction.resolved === "approve" ? "Approved" : "Rejected"}
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-3">
              <div className="size-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="size-4 text-primary" /></div>
              <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground animate-pulse">Thinking…</div>
            </div>
          )}
        </div>
      </SectionCard>

      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Ask about your operations…" className="flex-1 h-10 rounded-lg border border-input bg-transparent px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" disabled={busy} />
        <Button onClick={handleSend} disabled={!input.trim() || busy} className="gap-1.5"><Send className="size-4" /> Send</Button>
      </div>
    </div>
  );
}

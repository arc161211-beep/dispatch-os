import { useState, useRef, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; summary: string }[];
}

interface AIAssistantProps {
  /** Pre-prompt that restricts what the AI can access */
  systemContext?: string;
  /** Suggested questions to show */
  suggestedQuestions?: string[];
  /** Title for the assistant */
  title?: string;
  /** Description */
  description?: string;
}

export function AIAssistant({
  systemContext,
  suggestedQuestions = [
    "Where is my truck?",
    "What is my load status?",
    "When is pickup?",
    "When is delivery?",
    "Is POD uploaded?",
    "Show completed loads",
  ],
  title = "AI Assistant",
  description = "Ask about your operations",
}: AIAssistantProps) {
  const chat = useAction(api.ai.chat);
  const aiConfig = useQuery(api.ai.config);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      // Prepend system context if provided
      const fullMessage = systemContext ? `[Context: ${systemContext}] ${msg}` : msg;
      const result = await chat({ message: fullMessage, conversationId: conversationId as any });

      if (!result.configured) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "AI is not configured. Contact your administrator to enable the AI assistant.",
          },
        ]);
      } else if (result.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.reply!,
            toolCalls: result.toolCalls,
          },
        ]);
        if (result.conversationId) setConversationId(result.conversationId);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "I couldn't process that request. Please try again." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "An error occurred. Please try again." },
      ]);
    }
    setLoading(false);
  };

  if (!aiConfig?.configured) {
    return (
      <Card className="shadow-none border-border/70">
        <CardContent className="p-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium text-foreground">AI Not Configured</p>
              <p className="text-xs mt-1">Contact your administrator to enable the AI assistant.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none border-border/70">
      <CardContent className="p-0">
        {/* Chat messages */}
        <div ref={scrollRef} className="h-[40vh] overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="size-8 text-primary mb-3" />
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
              <div className="flex flex-wrap gap-2 mt-4 max-w-md justify-center">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="size-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="size-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-4 py-3",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.toolCalls.map((tc, j) => (
                      <div key={j} className="rounded-lg bg-background/50 p-2 text-xs">
                        <p className="font-medium text-muted-foreground">🔧 {tc.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="size-7 shrink-0 rounded-full bg-muted flex items-center justify-center">
                  <User className="size-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="size-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground animate-pulse">
                Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask about your operations…"
            className="flex-1 h-10 rounded-lg border border-input bg-transparent px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            disabled={loading}
          />
          <Button onClick={() => handleSend()} disabled={!input.trim() || loading} className="gap-1.5">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

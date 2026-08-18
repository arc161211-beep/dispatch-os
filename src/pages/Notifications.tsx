import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { PageHeader, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Bell, CheckCheck } from "lucide-react";
import { fmtRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Notif = any;

export default function Notifications() {
  const notifications = useQuery(api.notifications.list, {});
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const handleMarkAll = async () => {
    try { await markAllRead(); toast.success("All marked as read."); } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleMarkRead = async (n: Notif) => {
    if (n.readAt) return;
    try { await markRead({ id: n._id as any }); } catch {}
  };

  const unread = (notifications ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description={`${unread} unread`}
        actions={unread > 0 && <Button variant="outline" size="sm" onClick={handleMarkAll} className="gap-1.5"><CheckCheck className="size-3.5" /> Mark all read</Button>} />
      {notifications === undefined ? <LoadingState /> : (
        notifications.length === 0 ? <EmptyState icon={<Bell className="size-6" />} title="No notifications" description="You'll see notifications for completed loads, overdue invoices, and other events." /> : (
          <div className="space-y-1">
            {notifications.map((n) => (
              <button key={n._id} onClick={() => handleMarkRead(n)} className={cn("flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/40", !n.readAt && "bg-primary/5")}>
                <div className={cn("mt-1 size-2 shrink-0 rounded-full", n.readAt ? "bg-muted-foreground/30" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{fmtRelative(n._creationTime)}</p>
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } from "@/convex/constants";
import { useCanWrite, useTimezone } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Field, Grid, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { ListTodo, Plus, CheckCircle2 } from "lucide-react";
import { fmtDate, fmtRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

type TaskType = any;

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tz = useTimezone();
  const canWrite = useCanWrite();
  const [statusFilter, setStatusFilter] = useState("");
  const [dialog, setDialog] = useState<"create" | TaskType | null>(null);

  useEffect(() => {
    if (searchParams.get("new") === "1") { setDialog("create"); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  const tasks = useQuery(api.tasks.list, { status: (statusFilter || undefined) as any });
  const setStatusMut = useMutation(api.tasks.setStatus);

  const handleStatus = async (t: TaskType, s: string) => {
    try { await setStatusMut({ id: t._id as any, status: s as any }); toast.success(`Task → ${s}`); } catch (e) { toast.error(errorMessage(e)); }
  };

  const columns: Column<TaskType>[] = [
    { key: "title", header: "Task", render: (t) => <div><p className="font-medium text-sm">{t.title}</p>{t.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{t.description}</p>}</div> },
    { key: "type", header: "Type", hideOnMobile: true, render: (t) => <span className="text-sm text-muted-foreground">{t.type}</span> },
    { key: "priority", header: "Priority", render: (t) => <StatusBadge status={t.priority ?? "Normal"} /> },
    { key: "due", header: "Due", hideOnMobile: true, render: (t) => t.dueAt ? <span className={cn("text-sm", t.dueAt < Date.now() && t.status !== "Completed" ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground")}>{fmtRelative(t.dueAt)}</span> : <span className="text-sm text-muted-foreground">—</span> },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
    ...(canWrite ? [{ key: "actions" as const, header: "", hideOnMobile: true, render: (t: TaskType) => (
      <div className="flex justify-end gap-1">
        {t.status !== "Completed" && t.status !== "Cancelled" && (
          <Button variant="ghost" size="sm" className="gap-1 text-emerald-600" onClick={(e) => { e.stopPropagation(); handleStatus(t, "Completed"); }}><CheckCircle2 className="size-3" /> Done</Button>
        )}
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDialog(t); }}>Edit</Button>
      </div>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description={`${tasks?.length ?? 0} tasks`}
        actions={canWrite && <Button size="sm" className="gap-1.5" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New task</Button>} />
      <div className="flex gap-2 flex-wrap">
        <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-48">
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
      </div>
      {tasks === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={tasks} getKey={(t) => t._id} onRowClick={canWrite ? (t) => setDialog(t) : undefined}
          empty={<EmptyState icon={<ListTodo className="size-6" />} title="No tasks" description="Create your first task to stay on top of follow-ups." action={canWrite ? <Button size="sm" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New task</Button> : undefined} />} />
      )}
      {dialog && <TaskFormDialog task={dialog === "create" ? null : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function TaskFormDialog({ task, onClose }: { task: TaskType | null; onClose: () => void }) {
  const create = useMutation(api.tasks.create);
  const update = useMutation(api.tasks.update);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || undefined,
      type: (fd.get("type") as string || "General") as typeof TASK_TYPES[number],
      priority: (fd.get("priority") as string || "Normal") as typeof TASK_PRIORITIES[number],
      dueAt: fd.get("dueAt") ? new Date(String(fd.get("dueAt"))).getTime() : undefined,
    };
    try {
      if (task) { await update({ id: task._id as any, input }); toast.success("Task updated."); }
      else { await create({ input: input as any }); toast.success("Task created."); }
      onClose();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title" required><TextInput name="title" required defaultValue={task?.title ?? ""} /></Field>
          <Field label="Description"><TextArea name="description" defaultValue={task?.description ?? ""} /></Field>
          <Grid>
            <Field label="Type">
              <SelectInput name="type" defaultValue={task?.type ?? "General"}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectInput>
            </Field>
            <Field label="Priority">
              <SelectInput name="priority" defaultValue={task?.priority ?? "Normal"}>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </SelectInput>
            </Field>
            <Field label="Due date">
              <TextInput name="dueAt" type="date" defaultValue={task?.dueAt ? new Date(task.dueAt).toISOString().split("T")[0] : ""} />
            </Field>
          </Grid>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : task ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

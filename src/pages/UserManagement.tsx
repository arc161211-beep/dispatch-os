import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { ROLES, ACCOUNT_STATUSES } from "@/convex/constants";
import { useCanAdmin, useTimezone } from "@/hooks/use-app";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  LoadingState,
  EmptyState,
  errorMessage,
  ConfirmButton,
} from "@/components/app/shared";
import { Field, Grid, TextInput } from "@/components/app/forms";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  UserPlus,
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Building2,
  Clock,
  Search,
  Users,
  UserRound,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  dispatcher: "Dispatcher",
  operations: "Operations",
  carrier_admin: "Carrier Client",
  driver: "Driver",
  read_only: "Read Only",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  suspended: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  revoked: "bg-red-500/10 text-red-600 dark:text-red-400",
  invited: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export default function UserManagement() {
  const canAdmin = useCanAdmin();
  const { user: currentUser } = useAuth();
  const tz = useTimezone();
  const userData = useQuery(api.users.getOrgUsers);
  const carriers = useQuery(api.carriers.list, {});
  const driversList = useQuery(api.drivers.list, {});
  const setAccountStatus = useMutation(api.users.setAccountStatus);
  const updateUserRole = useMutation(api.users.updateUserRole);
  const assignCarrier = useMutation(api.users.assignCarrier);
  const revokeInvite = useMutation(api.users.revokeInvite);

  const [search, setSearch] = useState("");
  const [inviteDialog, setInviteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  if (!canAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Administrator access required</p>
          <p className="text-xs text-muted-foreground">Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  if (!userData) return <LoadingState label="Loading users..." />;

  const { members, pending } = userData;

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || m.accountStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      await setAccountStatus({
        userId: userId as any,
        accountStatus: status as any,
      });
      toast.success(`Account ${status}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateUserRole({
        userId: userId as any,
        role: role as any,
      });
      toast.success("Role updated");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const handleCarrierAssign = async (userId: string, carrierId: string | undefined) => {
    try {
      await assignCarrier({
        userId: userId as any,
        carrierId: (carrierId as any) || undefined,
      });
      toast.success("Carrier assignment updated");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await revokeInvite({ id: inviteId as any });
      toast.success("Invitation revoked");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const activeCount = members.filter((m) => m.accountStatus === "active").length;
  const suspendedCount = members.filter((m) => m.accountStatus === "suspended").length;
  const revokedCount = members.filter((m) => m.accountStatus === "revoked").length;
  const pendingCount = pending.filter((p) => p.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage access, roles, and permissions for your team"
        actions={
          <Button onClick={() => setInviteDialog(true)} className="gap-1.5">
            <UserPlus className="size-3.5" /> Invite User
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="shadow-none border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Total Users</p>
            </div>
            <p className="mt-1 text-2xl font-semibold">{members.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <p className="text-xs font-medium text-muted-foreground">Active</p>
            </div>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <p className="text-xs font-medium text-muted-foreground">Suspended</p>
            </div>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{suspendedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-blue-500" />
              <p className="text-xs font-medium text-muted-foreground">Pending Invites</p>
            </div>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Team Members ({members.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Invites ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User list */}
          {filteredMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No users found"
              description={search ? "Try a different search term." : "Invite team members to get started."}
            />
          ) : (
            <div className="divide-y rounded-lg border border-border/70">
              {filteredMembers.map((member) => (
                <UserRow
                  key={member._id}
                  member={member}
                  currentUserId={currentUser?._id}
                  carriers={carriers ?? []}
                  onStatusChange={handleStatusChange}
                  onRoleChange={handleRoleChange}
                  onCarrierAssign={handleCarrierAssign}
                  onEdit={() => setEditingUser(member)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pending.length === 0 ? (
            <EmptyState
              icon={<Mail className="size-6" />}
              title="No pending invitations"
              description="All invitations have been accepted or revoked."
            />
          ) : (
            <div className="divide-y rounded-lg border border-border/70">
              {pending.map((invite) => (
                <div key={invite._id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{invite.email}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[invite.role as Role] ?? invite.role}
                      </Badge>
                      {invite.carrierId && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Building2 className="size-3" /> {carriers?.find((c: any) => c._id === invite.carrierId)?.companyName ?? "Carrier"}
                        </span>
                      )}
                      {invite.driverId && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <UserRound className="size-3" /> Driver linked
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        Invited {fmtDateTime(invite.createdAt, tz)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        invite.status === "pending"
                          ? "bg-blue-500/10 text-blue-600"
                          : invite.status === "accepted"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-600",
                      )}
                    >
                      {invite.status}
                    </Badge>
                    {invite.status === "pending" && (
                      <ConfirmButton
                        trigger={
                          <Button variant="ghost" size="sm" className="text-destructive">
                            Revoke
                          </Button>
                        }
                        title="Revoke this invitation?"
                        description="The user will no longer be able to use this invitation to sign in."
                        onConfirm={() => handleRevokeInvite(invite._id)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <InviteUserDialog open={inviteDialog} onOpenChange={setInviteDialog} carriers={carriers ?? []} drivers={driversList ?? []} />

      {/* Edit user dialog */}
      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          carriers={carriers ?? []}
        />
      )}
    </div>
  );
}

function UserRow({
  member,
  currentUserId,
  carriers,
  onStatusChange,
  onRoleChange,
  onCarrierAssign,
  onEdit,
}: {
  member: any;
  currentUserId: string | undefined;
  carriers: any[];
  onStatusChange: (userId: string, status: string) => void;
  onRoleChange: (userId: string, role: string) => void;
  onCarrierAssign: (userId: string, carrierId: string | undefined) => void;
  onEdit: () => void;
}) {
  const isSelf = member._id === currentUserId;
  const status = member.accountStatus ?? "active";
  const carrierName = member.carrierId
    ? carriers.find((c: any) => c._id === member.carrierId)?.companyName ?? "Unknown"
    : null;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {member.name}
            {isSelf && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
          </p>
          <Badge variant="outline" className={cn("text-[10px] font-medium shrink-0", STATUS_COLORS[status])}>
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="size-3" /> {member.email}
          </span>
          {member.phone && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="size-3" /> {member.phone}
            </span>
          )}
          {carrierName && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="size-3" /> {carrierName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px]">
            {ROLE_LABELS[member.role as Role] ?? member.role}
          </Badge>
          {member.lastLoginAt > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="size-3" /> Last login: {fmtDateTime(member.lastLoginAt)}
            </span>
          )}
        </div>
      </div>

      {!isSelf && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onEdit}>Edit Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onStatusChange(member._id, "active")} disabled={status === "active"}>
              <CheckCircle2 className="mr-2 size-4" /> Activate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(member._id, "suspended")} disabled={status === "suspended"}>
              <ShieldOff className="mr-2 size-4" /> Suspend
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onStatusChange(member._id, "revoked")}
              disabled={status === "revoked"}
              className="text-destructive focus:text-destructive"
            >
              <UserX className="mr-2 size-4" /> Revoke Access
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const newRole = member.role === "dispatcher" ? "admin" : "dispatcher";
                onRoleChange(member._id, newRole);
              }}
            >
              <Shield className="mr-2 size-4" /> Change Role
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function InviteUserDialog({
  open,
  onOpenChange,
  carriers,
  drivers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carriers: any[];
  drivers: any[];
}) {
  const inviteUser = useMutation(api.users.inviteUser);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("dispatcher");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const role = String(fd.get("role") ?? "dispatcher");
      const inviteArgs: any = {
        email: String(fd.get("email") ?? ""),
        role,
        name: String(fd.get("name") ?? "") || undefined,
        phone: String(fd.get("phone") ?? "") || undefined,
      };
      // Link carrier if selected
      const carrierId = String(fd.get("carrierId") ?? "") || undefined;
      if (carrierId) inviteArgs.carrierId = carrierId;
      // Link driver if role is driver
      if (role === "driver") {
        const driverId = String(fd.get("driverId") ?? "") || undefined;
        if (driverId) inviteArgs.driverId = driverId;
      }
      await inviteUser(inviteArgs);
      toast.success("Invitation sent");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setSelectedRole("dispatcher"); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to join your workspace. They'll receive access once they sign in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid>
            <Field label="Email" required>
              <TextInput name="email" type="email" required placeholder="user@example.com" />
            </Field>
            <Field label="Name">
              <TextInput name="name" placeholder="John Smith" />
            </Field>
            <Field label="Role" required>
              <Select name="role" defaultValue="dispatcher" onValueChange={(v) => setSelectedRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "super_admin").map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r as Role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Carrier">
              <Select name="carrierId">
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {carriers.map((c: any) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {selectedRole === "driver" && (
              <Field label="Driver Record">
                <Select name="driverId">
                  <SelectTrigger>
                    <SelectValue placeholder="Link to existing driver (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {drivers.map((d: any) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}{d.email ? ` (${d.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Phone">
              <TextInput name="phone" type="tel" placeholder="(555) 123-4567" />
            </Field>
          </Grid>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
  carriers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  carriers: any[];
}) {
  const updateUserRole = useMutation(api.users.updateUserRole);
  const assignCarrier = useMutation(api.users.assignCarrier);
  const updateUserProfile = useMutation(api.users.updateUserProfile);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const role = String(fd.get("role") ?? user.role);
      const carrierId = String(fd.get("carrierId") ?? "") || undefined;
      const name = String(fd.get("name") ?? user.name);
      const phone = String(fd.get("phone") ?? "") || undefined;

      // Update role if changed
      if (role !== user.role) {
        await updateUserRole({ userId: user._id, role: role as any });
      }

      // Update carrier assignment
      await assignCarrier({
        userId: user._id,
        carrierId: (carrierId as any) || undefined,
      });

      // Update profile
      await updateUserProfile({
        userId: user._id,
        name,
        phone,
      });

      toast.success("User updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User: {user.name}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid>
            <Field label="Name">
              <TextInput name="name" defaultValue={user.name} />
            </Field>
            <Field label="Phone">
              <TextInput name="phone" type="tel" defaultValue={user.phone} />
            </Field>
            <Field label="Role" required>
              <Select name="role" defaultValue={user.role}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "super_admin").map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r as Role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Carrier">
              <Select name="carrierId" defaultValue={user.carrierId ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {carriers.map((c: any) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Grid>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

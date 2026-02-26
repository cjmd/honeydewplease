import { useState, useEffect } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, LogOut, Users, Check, X, UserMinus, Monitor, Sun, Moon, Plus, Pencil, Layers, Star } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Task } from "../App";
import { useTheme } from "next-themes";
import { TagManagement } from "./TagManagement";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { ChevronDown } from "lucide-react";

type SettingsMenuProps = {
  tasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SupabaseUser | null;
  onSignOut: () => void;
  onOpenAuth: () => void;
  workspaceId?: string | null;
  onDeleteTag: (tag: string) => void;
  onWorkspaceChange: (workspaceId: string) => void;
};

type UserWorkspace = {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  isDefault: boolean;
};

type WorkspaceMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  isCurrentUser?: boolean;
};

type Invitation = {
  id: string;
  from_email: string;
  workspace_id: string;
};

type OutgoingInvitation = {
  id: string;
  to_email: string;
  created_at: string;
};

export function SettingsMenu({
  tasks,
  open,
  onOpenChange,
  user,
  onSignOut,
  onOpenAuth,
  workspaceId,
  onDeleteTag,
  onWorkspaceChange
}: SettingsMenuProps) {
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [outgoingInvitations, setOutgoingInvitations] = useState<OutgoingInvitation[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [workspaceOwnerEmail, setWorkspaceOwnerEmail] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; email: string } | null>(null);
  const { theme, setTheme } = useTheme();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userWorkspaces, setUserWorkspaces] = useState<UserWorkspace[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState("");

  // Load workspace data when dialog opens
  useEffect(() => {
    if (open && user) {
      loadWorkspaceData();
      loadInvitations();
      loadOutgoingInvitations();
      loadUserProfile();
      loadUserWorkspaces();
    }
  }, [open, user, workspaceId]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setEditedName(data.name || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const loadUserWorkspaces = async () => {
    if (!user) return;

    try {
      // Get all workspace memberships for this user
      const { data: memberships, error: membershipError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id);

      if (membershipError) throw membershipError;

      if (!memberships || memberships.length === 0) {
        setUserWorkspaces([]);
        return;
      }

      // Get workspace details for each membership
      const workspaceIds = memberships.map((m: any) => m.workspace_id);
      const { data: workspaces, error: workspacesError } = await supabase
        .from("workspaces")
        .select("id, name")
        .in("id", workspaceIds);

      if (workspacesError) throw workspacesError;

      const activeWorkspaceId = workspaceId || localStorage.getItem("activeWorkspaceId");

      // Fetch default workspace from profile (DB is source of truth)
      let defaultWorkspaceId: string | null = null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.default_workspace_id) {
        defaultWorkspaceId = profile.default_workspace_id;
        localStorage.setItem("defaultWorkspaceId", defaultWorkspaceId);
      } else {
        localStorage.removeItem("defaultWorkspaceId");
      }

      const formattedWorkspaces: UserWorkspace[] = (workspaces || []).map((ws: any) => {
        const membership = memberships.find((m: any) => m.workspace_id === ws.id);
        return {
          id: ws.id,
          name: ws.name || "My Workspace",
          role: membership?.role || "member",
          isActive: ws.id === activeWorkspaceId,
          isDefault: ws.id === defaultWorkspaceId
        };
      });

      // Sort: active workspace first, then by name
      formattedWorkspaces.sort((a, b) => {
        if (a.isActive) return -1;
        if (b.isActive) return 1;
        return a.name.localeCompare(b.name);
      });

      setUserWorkspaces(formattedWorkspaces);
    } catch (error) {
      console.error("Error loading user workspaces:", error);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!user) {
      console.log("No user found");
      return;
    }

    const name = newWorkspaceName.trim() || "New Workspace";

    try {
      // Use the secure database function to create workspace
      const { data: newWorkspaceId, error } = await supabase
        .rpc('create_workspace', { workspace_name: name });

      if (error) {
        console.error("Workspace creation error:", error);
        throw error;
      }

      console.log("Workspace created:", newWorkspaceId);

      toast.success(`Workspace "${name}" created`);
      setNewWorkspaceName("");
      setIsCreatingWorkspace(false);

      // Switch to new workspace
      handleSwitchWorkspace(newWorkspaceId);
      loadUserWorkspaces();
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      toast.error(error.message || "Failed to create workspace");
    }
  };

  const handleSwitchWorkspace = (newWorkspaceId: string) => {
    localStorage.setItem("activeWorkspaceId", newWorkspaceId);
    onWorkspaceChange(newWorkspaceId);
    window.dispatchEvent(new CustomEvent("workspace-changed", { detail: newWorkspaceId }));
    
    // Update local state
    setUserWorkspaces(prev => prev.map(ws => ({
      ...ws,
      isActive: ws.id === newWorkspaceId
    })));
    
    // Reload workspace data for the new workspace
    loadWorkspaceData();
  };

  const handleSetDefaultWorkspace = async (wsId: string) => {
    if (!user) return;
    const currentDefault = localStorage.getItem("defaultWorkspaceId");
    const newDefault = currentDefault === wsId ? null : wsId;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ default_workspace_id: newDefault } as any)
        .eq("id", user.id);
      if (error) throw error;

      if (newDefault) {
        localStorage.setItem("defaultWorkspaceId", newDefault);
        toast.success("Default workspace set");
      } else {
        localStorage.removeItem("defaultWorkspaceId");
        toast.success("Default workspace cleared");
      }
    } catch (error) {
      console.error("Error saving default workspace:", error);
      toast.error("Failed to save default workspace");
    }
    loadUserWorkspaces();
  };

  const handleRenameWorkspace = async (wsId: string) => {
    if (!editingWorkspaceName.trim()) {
      toast.error("Workspace name cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: editingWorkspaceName.trim() })
        .eq("id", wsId);

      if (error) throw error;

      toast.success("Workspace renamed");
      setEditingWorkspaceId(null);
      setEditingWorkspaceName("");
      loadUserWorkspaces();
    } catch (error: any) {
      console.error("Error renaming workspace:", error);
      toast.error(error.message || "Failed to rename workspace");
    }
  };

  const loadWorkspaceData = async () => {
    if (!user) return;

    try {
      // Determine active workspace
      let activeWorkspaceId = workspaceId || localStorage.getItem("activeWorkspaceId");

      if (!activeWorkspaceId) {
        const { data: latestMembership } = await supabase
          .from("workspace_members")
          .select("workspace_id, created_at, role")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        activeWorkspaceId = latestMembership?.workspace_id || null;
        if (activeWorkspaceId) localStorage.setItem("activeWorkspaceId", activeWorkspaceId);
      }

      if (!activeWorkspaceId) return;

      // Get current user's role in this workspace
      const { data: myMembership, error: roleError } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) throw roleError;
      setIsOwner(myMembership?.role === "owner");

      // Get workspace owner info
      const { data: workspaceData } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", activeWorkspaceId)
        .maybeSingle();

      if (workspaceData) {
        const { data: ownerEmail } = await supabase.rpc("get_user_email", { _user_id: workspaceData.owner_id });
        setWorkspaceOwnerEmail(ownerEmail || null);
      }

      // Get all workspace members
      const { data: members, error: membersError } = await supabase
        .from("workspace_members")
        .select("id, user_id, role")
        .eq("workspace_id", activeWorkspaceId);

      if (membersError) throw membersError;

      const formattedMembers: WorkspaceMember[] = await Promise.all(
        (members || []).map(async (m: any) => {
          try {
            const { data: email } = await supabase.rpc("get_user_email", { _user_id: m.user_id });
            return {
              id: m.id,
              email: email || "Unknown",
              name: email || "Member",
              role: m.role,
              isCurrentUser: m.user_id === user.id
            };
          } catch {
            return {
              id: m.id,
              email: "Unknown",
              name: "Member",
              role: m.role,
              isCurrentUser: m.user_id === user.id
            };
          }
        })
      );

      setWorkspaceMembers(formattedMembers);
    } catch (error) {
      console.error("Error loading workspace:", error);
    }
  };

  const loadInvitations = async () => {
    if (!user) return;

    try {
      // First, get workspaces the user is already a member of
      const { data: membershipData } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id);

      const memberWorkspaceIds = new Set((membershipData || []).map((m: any) => m.workspace_id));

      // Fetch pending invitations where the current user is the RECIPIENT (not the sender)
      const { data, error } = await supabase
        .from("invitations")
        .select("id, workspace_id, from_user_id, to_email, created_at, status")
        .eq("status", "pending")
        .neq("from_user_id", user.id) // Exclude invitations sent BY this user
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter out invitations for workspaces the user has already joined
      const userInvitations = (data || []).filter(
        (inv: any) => !memberWorkspaceIds.has(inv.workspace_id)
      );

      // Keep only the most recent invitation per workspace to avoid duplicates
      const dedupedMap = new Map<string, any>();
      userInvitations.forEach((inv: any) => {
        if (!dedupedMap.has(inv.workspace_id)) {
          dedupedMap.set(inv.workspace_id, inv);
        }
      });
      const deduped = Array.from(dedupedMap.values());

      // Resolve sender emails using a secure definer function
      const formatted: Invitation[] = await Promise.all(
        deduped.map(async (inv: any) => {
          try {
            const { data: senderEmail } = await supabase.rpc("get_user_email", { _user_id: inv.from_user_id });
            return {
              id: inv.id,
              workspace_id: inv.workspace_id,
              from_email: senderEmail || "Unknown"
            };
          } catch {
            return { id: inv.id, workspace_id: inv.workspace_id, from_email: "Unknown" };
          }
        })
      );

      setPendingInvitations(formatted);
    } catch (error) {
      console.error("Error loading invitations:", error);
    }
  };

  const loadOutgoingInvitations = async () => {
    if (!user || !workspaceId) {
      setOutgoingInvitations([]);
      return;
    }

    try {
      // Get all workspace members' emails to filter out already-joined users
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);

      const memberEmails = new Set<string>();
      if (members) {
        await Promise.all(
          members.map(async (m: any) => {
            const { data: email } = await supabase.rpc("get_user_email", { _user_id: m.user_id });
            if (email) memberEmails.add(email.toLowerCase());
          })
        );
      }

      // Get pending invitations sent from this workspace
      const { data, error } = await supabase
        .from("invitations")
        .select("id, to_email, created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter out invitations for users who are already members
      const filteredInvitations = (data || []).filter(
        (inv) => !memberEmails.has(inv.to_email.toLowerCase())
      );

      setOutgoingInvitations(filteredInvitations);
    } catch (error) {
      console.error("Error loading outgoing invitations:", error);
      setOutgoingInvitations([]);
    }
  };

  const handleInviteCollaborator = async () => {
    if (!user) {
      toast.error("You must be signed in to invite collaborators");
      return;
    }

    if (!workspaceId) {
      toast.error("No workspace found. Please try refreshing the page.");
      return;
    }

    if (!collaboratorEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(collaboratorEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (collaboratorEmail === user.email) {
      toast.error("You cannot invite yourself");
      return;
    }

    try {

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("workspace_members")
        .select("id, profiles:user_id(email)")
        .eq("workspace_id", workspaceId);

      if (existingMember?.some((m: any) => m.profiles?.email === collaboratorEmail)) {
        toast.error("This user is already a collaborator");
        return;
      }

      // Check if invitation already exists
      const { data: existingInvitation } = await supabase
        .from("invitations")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("to_email", collaboratorEmail)
        .eq("status", "pending")
        .maybeSingle();

      if (existingInvitation) {
        toast.error("An invitation is already pending for this email");
        return;
      }

      // Create invitation
      const { error: inviteError } = await supabase
        .from("invitations")
        .insert({
          workspace_id: workspaceId,
          from_user_id: user.id,
          to_email: collaboratorEmail.trim().toLowerCase()
        });

      if (inviteError) throw inviteError;

      toast.success(`Invitation sent to ${collaboratorEmail}`);
      setCollaboratorEmail("");
      loadOutgoingInvitations();
    } catch (error: any) {
      console.error("Error inviting collaborator:", error);
      toast.error(error.message || "Failed to send invitation");
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "declined" })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Invitation cancelled");
      setOutgoingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (error: any) {
      console.error("Error cancelling invitation:", error);
      toast.error(error.message || "Failed to cancel invitation");
    }
  };

  const handleAcceptInvitation = async (invitationId: string, workspaceId: string) => {
    if (!user) return;

    try {
      // Add user to workspace
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          role: "member"
        });

      if (memberError) throw memberError;

      // Mark this invite as accepted
      const { error: inviteError } = await supabase
        .from("invitations")
        .update({ status: "accepted" })
        .eq("id", invitationId);

      if (inviteError) throw inviteError;

      // Persist and broadcast active workspace change so new tasks are created in the shared space
      localStorage.setItem("activeWorkspaceId", workspaceId);
      window.dispatchEvent(new CustomEvent("workspace-changed", { detail: workspaceId }));

      // Remove any remaining invites for the same workspace from the UI
      setPendingInvitations(prev => prev.filter(inv => inv.workspace_id !== workspaceId));

      toast.success("Invitation accepted! You can now collaborate.");
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast.error(error.message || "Failed to accept invitation");
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "declined" })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Invitation declined");
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (error: any) {
      console.error("Error declining invitation:", error);
      toast.error(error.message || "Failed to decline invitation");
    }
  };

  const handleRemoveCollaborator = async (memberId: string) => {
    try {
      // Get the member's user_id and workspace_id before deleting
      const memberToDelete = workspaceMembers.find(m => m.id === memberId);
      if (!memberToDelete) return;

      // First, get the user_id from workspace_members
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("user_id, workspace_id")
        .eq("id", memberId)
        .maybeSingle();

      // Delete the workspace membership
      const { error: deleteError } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);

      if (deleteError) throw deleteError;

      // Clean up any pending invitations for this user to this workspace
      if (memberData) {
        const { data: userProfile } = await supabase.rpc("get_user_email", { _user_id: memberData.user_id });
        
        if (userProfile) {
          await supabase
            .from("invitations")
            .update({ status: "declined" })
            .eq("workspace_id", memberData.workspace_id)
            .eq("to_email", userProfile.toLowerCase())
            .eq("status", "pending");
        }
      }

      toast.success("Collaborator removed");
      setMemberToRemove(null);
      await loadWorkspaceData();
    } catch (error: any) {
      console.error("Error removing collaborator:", error);
      toast.error(error.message || "Failed to remove collaborator");
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!editedName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: editedName.trim() })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Failed to update profile");
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      toast.error("Please enter a new email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim()
      });

      if (error) throw error;

      toast.success("Email update initiated. Please check your new email for confirmation.");
      setNewEmail("");
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast.error(error.message || "Failed to update email");
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setNewEmail("");
    setNewPassword("");
    setConfirmPassword("");
    loadUserProfile(); // Reset to original value
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[340px] sm:w-[400px] overflow-y-auto">
          <SheetHeader className="p-[16px] py-0 px-0">
            <SheetTitle className="text-[20px] text-foreground">
              Settings
            </SheetTitle>
            <SheetDescription className="text-[14px] text-[#999999]">
              Manage your lists and collaborators
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6 px-[8px] px-[16px] py-[0px]">
            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <>
                <div className="space-y-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <h3 className="text-[16px] text-foreground mb-2 flex items-center gap-2">
                    <Users size={18} className="text-primary" />
                    Collaboration Invitation
                  </h3>
                  {pendingInvitations.map((invitation) => (
                    <div key={invitation.id} className="space-y-3">
                      <p className="text-[14px] text-foreground">
                        <span className="font-semibold">{invitation.from_email}</span> invited you to collaborate on their lists
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAcceptInvitation(invitation.id, invitation.workspace_id)}
                          className="flex-1 gap-2"
                          size="sm"
                        >
                          <Check size={16} />
                          Accept
                        </Button>
                        <Button
                          onClick={() => handleDeclineInvitation(invitation.id)}
                          variant="outline"
                          className="flex-1 gap-2"
                          size="sm"
                        >
                          <X size={16} />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
              </>
            )}

            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] text-foreground mb-1">
                  Appearance
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  {theme === "system" 
                    ? "System (auto)" 
                    : theme === "light" 
                    ? "Light mode" 
                    : "Dark mode"}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    {theme === "light" ? (
                      <Sun size={16} />
                    ) : theme === "dark" ? (
                      <Moon size={16} />
                    ) : (
                      <Monitor size={16} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background">
                  <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
                    <Monitor size={16} />
                    System
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
                    <Sun size={16} />
                    Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
                    <Moon size={16} />
                    Dark
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Workspaces Section */}
            {user && userWorkspaces.length > 0 && (
              <>
                <Separator />
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:opacity-80 transition-opacity">
                    <h3 className="text-[16px] text-foreground flex items-center gap-2">
                      <Layers size={18} />
                      Workspaces
                    </h3>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-3">
                    {userWorkspaces.map((ws) => (
                      <div
                        key={ws.id}
                        className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                          ws.isActive
                            ? "bg-primary/10 border border-primary/20"
                            : "bg-muted/30 hover:bg-muted/50"
                        }`}
                        onClick={() => !ws.isActive && handleSwitchWorkspace(ws.id)}
                      >
                        <div className="flex-1 min-w-0">
                          {editingWorkspaceId === ws.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingWorkspaceName}
                                onChange={(e) => setEditingWorkspaceName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenameWorkspace(ws.id);
                                  if (e.key === "Escape") {
                                    setEditingWorkspaceId(null);
                                    setEditingWorkspaceName("");
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-[13px]"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                className="h-7 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameWorkspace(ws.id);
                                }}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] text-foreground truncate font-medium">
                                {ws.name}
                              </p>
                              {ws.isActive && (
                                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {ws.role}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 w-7 p-0 ${ws.isDefault ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefaultWorkspace(ws.id);
                            }}
                            title={ws.isDefault ? "Clear default" : "Set as default workspace"}
                          >
                            <Star size={14} fill={ws.isDefault ? "currentColor" : "none"} />
                          </Button>
                          {ws.role === "owner" && editingWorkspaceId !== ws.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWorkspaceId(ws.id);
                                setEditingWorkspaceName(ws.name);
                              }}
                            >
                              <Pencil size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Create New Workspace */}
                    {isCreatingWorkspace ? (
                      <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                        <Input
                          placeholder="Workspace name"
                          value={newWorkspaceName}
                          onChange={(e) => setNewWorkspaceName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateWorkspace();
                            if (e.key === "Escape") {
                              setIsCreatingWorkspace(false);
                              setNewWorkspaceName("");
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleCreateWorkspace} className="flex-1">
                            Create
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsCreatingWorkspace(false);
                              setNewWorkspaceName("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => setIsCreatingWorkspace(true)}
                      >
                        <Plus size={16} />
                        Create New Workspace
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            {/* Workspace Members Section - Show for all users who are part of a workspace */}
            {user && workspaceMembers.length > 0 && (
              <>
                <Separator />
                
                {/* Show whose workspace this is for non-owners */}
                {!isOwner && workspaceOwnerEmail && (
                  <div className="space-y-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <h3 className="text-[14px] text-foreground font-semibold">
                      Shared Workspace
                    </h3>
                    <p className="text-[13px] text-foreground">
                      You're collaborating with <span className="font-semibold">{workspaceOwnerEmail}</span>
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      You can both see, add, edit, and complete all tasks in this shared space.
                    </p>
                  </div>
                )}

                {/* Workspace Members List */}
                <div className="space-y-4">
                  <h3 className="text-[16px] text-foreground mb-2 flex items-center gap-2">
                    <Users size={18} />
                    {isOwner ? "Collaborators" : "Workspace Members"}
                  </h3>
                  <div className="space-y-2">
                    {workspaceMembers.map((member) => {
                      const canRemove = isOwner && member.role !== "owner" && !member.isCurrentUser;
                      return (
                        <div key={member.id} className={`flex items-center gap-2 p-2 rounded-lg ${
                          member.isCurrentUser ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                        }`}>
                          <User className="text-muted-foreground flex-shrink-0" size={16} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-foreground truncate">
                              {member.email}
                              {member.isCurrentUser && " (You)"}
                            </p>
                          </div>
                          <span className={`text-[11px] uppercase px-2 py-1 rounded flex-shrink-0 ${
                            member.role === "owner" 
                              ? "bg-primary/20 text-primary font-semibold"
                              : "text-muted-foreground"
                          }`}>
                            {member.role}
                          </span>
                          {canRemove && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMemberToRemove({ id: member.id, email: member.email })}
                              className="h-7 w-7 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                            >
                              <UserMinus size={14} />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Invite Collaborator Section */}
            {user && (
              <>
                <Separator />
                
                {/* Show pending outgoing invitations for owners */}
                {isOwner && outgoingInvitations.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-[16px] text-foreground mb-2">
                      Pending Invitations ({outgoingInvitations.length})
                    </h3>
                    <div className="space-y-2">
                      {outgoingInvitations.map((invitation) => (
                        <div key={invitation.id} className="flex items-center gap-3 p-2 bg-accent/50 border border-accent rounded-lg">
                          <div className="flex-1">
                            <p className="text-[13px] text-foreground">
                              {invitation.to_email}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Sent {new Date(invitation.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="h-7 px-3 hover:bg-red-50 hover:text-red-600 text-[12px]"
                          >
                            Cancel
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite form for owners */}
                {isOwner && (
                  <>
                    {outgoingInvitations.length > 0 && <Separator />}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-[16px] text-foreground mb-2">
                          Invite Collaborator
                        </h3>
                        <p className="text-[14px] text-muted-foreground mb-3">
                          Share your lists with someone. They'll be able to add, edit, complete, and delete items.
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <Label htmlFor="email" className="text-foreground">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="collaborator@example.com"
                          value={collaboratorEmail}
                          onChange={(e) => setCollaboratorEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleInviteCollaborator();
                            }
                          }}
                        />
                        <Button
                          onClick={handleInviteCollaborator}
                          className="w-full"
                          disabled={!collaboratorEmail.trim()}
                        >
                          Send Invitation
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Tag Management Section */}
            <Separator />
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:opacity-80 transition-opacity">
                <h3 className="text-[16px] text-foreground">
                  Manage Tags
                </h3>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <TagManagement tasks={tasks} onDeleteTag={onDeleteTag} />
              </CollapsibleContent>
            </Collapsible>

            {/* Account Section - Moved to bottom */}
            {(user || !user) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-[16px] text-foreground mb-2">
                    Account
                  </h3>
                  {user ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-muted/30 rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                          <User className="text-muted-foreground flex-shrink-0" size={20} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        
                        {isEditingProfile ? (
                          <div className="space-y-3">
                            {/* Display Name */}
                            <div className="space-y-2">
                              <Label htmlFor="profile-name" className="text-[13px]">Display Name</Label>
                              <Input
                                id="profile-name"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                placeholder="Enter your name"
                                className="text-[14px]"
                              />
                              <Button
                                onClick={handleSaveProfile}
                                size="sm"
                                className="w-full"
                              >
                                Update Name
                              </Button>
                            </div>

                            <Separator />

                            {/* Email Change */}
                            <div className="space-y-2">
                              <Label htmlFor="new-email" className="text-[13px]">Change Email</Label>
                              <Input
                                id="new-email"
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="New email address"
                                className="text-[14px]"
                              />
                              <Button
                                onClick={handleUpdateEmail}
                                size="sm"
                                variant="outline"
                                className="w-full"
                                disabled={!newEmail.trim()}
                              >
                                Update Email
                              </Button>
                            </div>

                            <Separator />

                            {/* Password Change */}
                            <div className="space-y-2">
                              <Label htmlFor="new-password" className="text-[13px]">Change Password</Label>
                              <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New password"
                                className="text-[14px]"
                              />
                              <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                className="text-[14px]"
                              />
                              <Button
                                onClick={handleUpdatePassword}
                                size="sm"
                                variant="outline"
                                className="w-full"
                                disabled={!newPassword || !confirmPassword}
                              >
                                Update Password
                              </Button>
                            </div>

                            <Button
                              onClick={handleCancelEdit}
                              variant="ghost"
                              size="sm"
                              className="w-full"
                            >
                              Done
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-foreground mb-0.5">Display Name</p>
                              <p className="text-[14px] text-foreground truncate">
                                {editedName || "No name set"}
                              </p>
                            </div>
                            <Button
                              onClick={() => setIsEditingProfile(true)}
                              variant="outline"
                              size="sm"
                              className="text-[12px] h-8 px-3 flex-shrink-0"
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button onClick={onSignOut} variant="outline" className="w-full gap-2">
                        <LogOut size={16} />
                        Sign Out
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[14px] text-[#666666]">
                        Sign in to sync your tasks across devices and collaborate with others.
                      </p>
                      <Button
                        onClick={() => {
                          onOpenChange(false);
                          onOpenAuth();
                        }}
                        className="w-full"
                      >
                        Sign In / Sign Up
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm Remove Collaborator Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Collaborator?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.email}</strong> from your workspace? 
              They will no longer have access to your shared tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && handleRemoveCollaborator(memberToRemove.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
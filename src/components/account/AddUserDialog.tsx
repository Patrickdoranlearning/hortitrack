"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, CheckCircle2, Key } from "lucide-react";

interface AddUserDialogProps {
  onUserAdded: () => void;
}

type CreatedUser = {
  email: string;
  password: string;
  name: string;
};

export function AddUserDialog({ onUserAdded }: AddUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("grower");
  const [isLoading, setIsLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setRole("grower");
    setCreatedUser(null);
    setCopiedField(null);
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, fullName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      // If we got credentials back, show them
      if (data.credentials) {
        setCreatedUser({
          email: data.credentials.email,
          password: data.credentials.password,
          name: fullName,
        });
        toast({
          title: "User Created",
          description: "Share the login credentials with your team member.",
        });
        onUserAdded();
      } else {
        toast({
          title: "Success",
          description: data.message || "User invited successfully",
        });
        handleClose();
        onUserAdded();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{createdUser ? "User Created Successfully" : "Add Team Member"}</DialogTitle>
          <DialogDescription>
            {createdUser 
              ? "Share these login credentials with your new team member."
              : "Create a new user account for your team member."
            }
          </DialogDescription>
        </DialogHeader>

        {createdUser ? (
          <div className="space-y-4 py-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Account Created!</AlertTitle>
              <AlertDescription className="text-green-700">
                {createdUser.name} can now log in with these credentials.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Login URL</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`${window.location.origin}/login`} 
                    readOnly 
                    className="font-mono text-sm bg-muted"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(`${window.location.origin}/login`, "url")}
                  >
                    {copiedField === "url" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={createdUser.email} 
                    readOnly 
                    className="font-mono text-sm bg-muted"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(createdUser.email, "email")}
                  >
                    {copiedField === "email" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={createdUser.password} 
                    readOnly 
                    className="font-mono text-sm bg-muted"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(createdUser.password, "password")}
                  >
                    {copiedField === "password" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  const message = `Your HortiTrack login:\n\nURL: ${window.location.origin}/login\nEmail: ${createdUser.email}\nPassword: ${createdUser.password}\n\nPlease change your password after first login.`;
                  copyToClipboard(message, "all");
                }}
              >
                {copiedField === "all" ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy All Credentials
              </Button>
            </div>

            <DialogFooter className="pt-4">
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Owner</span>
                        <span className="text-xs text-muted-foreground">Full access including billing</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Admin</span>
                        <span className="text-xs text-muted-foreground">Manage team and all features</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="grower">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Grower (Picker)</span>
                        <span className="text-xs text-muted-foreground">Nursery operative: pick orders, update batches</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="sales">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Sales</span>
                        <span className="text-xs text-muted-foreground">Create orders, manage customers</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Viewer</span>
                        <span className="text-xs text-muted-foreground">Read-only access to data</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  A temporary password will be generated. You can share the credentials with your team member directly.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !fullName || !email}>
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

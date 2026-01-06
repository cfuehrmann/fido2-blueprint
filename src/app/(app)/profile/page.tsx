"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KeyRound, Trash2, Plus, LogOut } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: profile } = trpc.profile.get.useQuery();
  const { data: credentials } = trpc.profile.getCredentials.useQuery();

  const updateDisplayName = trpc.profile.updateDisplayName.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => router.push("/login"),
  });
  const addPasskeyStart = trpc.profile.addPasskeyStart.useMutation();
  const addPasskeyFinish = trpc.profile.addPasskeyFinish.useMutation({
    onSuccess: () => utils.profile.getCredentials.invalidate(),
  });
  const deleteCredential = trpc.profile.deleteCredential.useMutation({
    onSuccess: () => utils.profile.getCredentials.invalidate(),
  });

  const [displayName, setDisplayName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);

  async function handleUpdateDisplayName(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateDisplayName.mutateAsync({ displayName });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleAddPasskey() {
    setError(null);
    setIsAddingPasskey(true);

    try {
      const { options } = await addPasskeyStart.mutateAsync();
      const credential = await startRegistration({ optionsJSON: options });
      await addPasskeyFinish.mutateAsync({ credential });
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Passkey creation was cancelled");
        } else {
          setError(err.message);
        }
      }
    } finally {
      setIsAddingPasskey(false);
    }
  }

  async function handleDeleteCredential(credentialId: string) {
    if (!confirm("Are you sure you want to remove this passkey?")) return;

    try {
      await deleteCredential.mutateAsync({ credentialId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function formatDate(date: Date | string | null) {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profile</h1>
          <Button
            variant="outline"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Manage your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Username</Label>
              <p className="font-medium">{profile?.username}</p>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdateDisplayName} className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                  />
                  <Button type="submit" disabled={updateDisplayName.isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <Label className="text-muted-foreground">Display Name</Label>
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {profile?.displayName || "Not set"}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDisplayName(profile?.displayName || "");
                      setIsEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-muted-foreground">Member since</Label>
              <p className="font-medium">
                {profile?.createdAt ? formatDate(profile.createdAt) : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Passkeys */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Passkeys</CardTitle>
                <CardDescription>
                  Manage your registered passkeys
                </CardDescription>
              </div>
              <Button
                onClick={handleAddPasskey}
                disabled={isAddingPasskey}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isAddingPasskey ? "Adding..." : "Add passkey"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-sm text-destructive mb-4">{error}</div>
            )}

            <div className="space-y-3">
              {credentials?.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <KeyRound className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {cred.deviceType === "multiDevice"
                          ? "Multi-device passkey"
                          : "Single-device passkey"}
                        {cred.backedUp && " (synced)"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Created: {formatDate(cred.createdAt)} · Last used:{" "}
                        {formatDate(cred.lastUsedAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteCredential(cred.id)}
                    disabled={deleteCredential.isPending}
                    title="Remove passkey"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {credentials?.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No passkeys registered
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

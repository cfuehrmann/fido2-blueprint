"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginStart = trpc.auth.loginStart.useMutation();
  const loginFinish = trpc.auth.loginFinish.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Get authentication options from server
      const { options, userId } = await loginStart.mutateAsync({ username });

      // Step 2: Authenticate with passkey
      const credential = await startAuthentication({ optionsJSON: options });

      // Step 3: Verify with server
      await loginFinish.mutateAsync({
        userId,
        credential,
      });

      // Success - redirect to profile
      router.push("/profile");
    } catch (err) {
      if (err instanceof Error) {
        // Handle WebAuthn errors
        if (err.name === "NotAllowedError") {
          setError("Authentication was cancelled or timed out");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Use your passkey to sign in securely</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              disabled={isLoading}
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Authenticating..." : "Sign in with passkey"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

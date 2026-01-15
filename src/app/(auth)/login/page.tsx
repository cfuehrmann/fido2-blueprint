"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";

function getErrorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) {
    // Check for Zod validation errors
    const zodErrors = err.data?.zodError?.fieldErrors;
    if (zodErrors) {
      // Get first field's first error message
      const firstField = Object.keys(zodErrors)[0];
      if (firstField && zodErrors[firstField]?.[0]) {
        return zodErrors[firstField][0];
      }
    }
    // Fall back to tRPC error message
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred";
}
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") ?? "";

  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const loginStart = trpc.auth.loginStart.useMutation();
  const loginFinish = trpc.auth.loginFinish.useMutation();
  const registerStart = trpc.auth.registerStart.useMutation();
  const registerFinish = trpc.auth.registerFinish.useMutation();

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
      // Handle WebAuthn errors specially
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Authentication was cancelled or timed out");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    setError(null);
    setIsRegistering(true);

    try {
      // Step 1: Get registration options from server
      const {
        options,
        userId,
        username: normalizedUsername,
      } = await registerStart.mutateAsync({ username });

      // Step 2: Create credential with authenticator
      const credential = await startRegistration({ optionsJSON: options });

      // Step 3: Verify with server and create account
      await registerFinish.mutateAsync({
        userId,
        username: normalizedUsername,
        credential,
      });

      // Success - redirect to profile
      router.push("/profile");
    } catch (err) {
      // Handle WebAuthn errors specially
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Passkey creation was cancelled or timed out");
          return;
        } else if (err.name === "InvalidStateError") {
          setError("This passkey is already registered");
          return;
        }
      }
      setError(getErrorMessage(err));
    } finally {
      setIsRegistering(false);
    }
  }

  const isDisabled = isLoading || isRegistering;

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
              disabled={isDisabled}
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isDisabled}>
            {isLoading ? "Authenticating..." : "Sign in with passkey"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={handleRegister}
              disabled={isDisabled}
              className="text-primary hover:underline disabled:opacity-50"
            >
              {isRegistering ? "Creating account..." : "Create one"}
            </button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

function LoginFormFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Use your passkey to sign in securely</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="johndoe"
            disabled
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button className="w-full" disabled>
          Sign in with passkey
        </Button>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <button type="button" disabled className="text-primary opacity-50">
            Create one
          </button>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}

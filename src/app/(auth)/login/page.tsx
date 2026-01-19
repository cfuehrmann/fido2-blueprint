"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";

import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { usernameSchema } from "@/lib/validation";
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

function getErrorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) {
    // Check for Zod validation errors (properly formatted by server)
    const zodError = err.data?.zodError;
    if (zodError?.fieldErrors) {
      const firstField = Object.keys(zodError.fieldErrors)[0];
      if (firstField && zodError.fieldErrors[firstField]?.[0]) {
        return zodError.fieldErrors[firstField][0];
      }
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred";
}

function validateUsername(username: string): string | null {
  const result = usernameSchema.safeParse(username);
  if (!result.success) {
    return result.error.issues[0]?.message ?? "Invalid username";
  }
  return null;
}

function LoginForm() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [showRegistration, setShowRegistration] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const loginStart = trpc.auth.loginStart.useMutation();
  const loginFinish = trpc.auth.loginFinish.useMutation();
  const registerStart = trpc.auth.registerStart.useMutation();
  const registerFinish = trpc.auth.registerFinish.useMutation();

  async function handleLogin() {
    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Get authentication options from server (no username needed)
      const { options } = await loginStart.mutateAsync();

      // Step 2: Authenticate with passkey - browser shows all discoverable credentials
      const credential = await startAuthentication({ optionsJSON: options });

      // Step 3: Verify with server (user is identified by credential ID)
      await loginFinish.mutateAsync({
        credential,
      });

      // Invalidate session cache before redirect to prevent race condition
      await utils.auth.session.invalidate();

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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsRegistering(true);

    try {
      // Step 1: Get registration options from server
      const { options } = await registerStart.mutateAsync({ username });

      // Step 2: Create credential with authenticator
      const credential = await startRegistration({ optionsJSON: options });

      // Step 3: Verify with server and create account
      await registerFinish.mutateAsync({
        credential,
      });

      // Invalidate session cache before redirect to prevent race condition
      await utils.auth.session.invalidate();

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

  // Registration view
  if (showRegistration) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Choose a username and create a passkey
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister} noValidate>
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
                disabled={isDisabled}
                autoFocus
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button type="submit" className="w-full" disabled={isDisabled}>
              {isRegistering ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setShowRegistration(false);
                  setError(null);
                }}
                disabled={isDisabled}
                className="text-primary hover:underline disabled:opacity-50"
              >
                Sign in
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // Login view (default)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Use a passkey to sign in securely</CardDescription>
      </CardHeader>
      {error && (
        <CardContent>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      )}
      <CardFooter className="flex flex-col space-y-4">
        <Button onClick={handleLogin} className="w-full" disabled={isDisabled}>
          {isLoading ? "Authenticating..." : "Sign in with passkey"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => {
              setShowRegistration(true);
              setError(null);
            }}
            disabled={isDisabled}
            className="text-primary hover:underline disabled:opacity-50"
          >
            Create one
          </button>
        </p>
      </CardFooter>
    </Card>
  );
}

function LoginFormFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Use a passkey to sign in securely</CardDescription>
      </CardHeader>
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

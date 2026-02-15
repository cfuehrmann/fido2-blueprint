"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { startRegistration } from "@simplewebauthn/browser";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errors";
import { usernameSchema } from "@repo/fido2-auth";
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

function validateUsername(username: string): string | null {
  const result = usernameSchema.safeParse(username);
  if (!result.success) {
    return result.error.issues[0]?.message ?? "Invalid username";
  }
  return null;
}

function RegisterCard({
  username,
  onUsernameChange,
  error,
  isRegistering,
  onSubmit,
}: {
  username?: string;
  onUsernameChange?: (value: string) => void;
  error?: string | null;
  isRegistering?: boolean;
  onSubmit?: (e: React.SubmitEvent) => void;
}) {
  const disabled = isRegistering || !onSubmit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Choose a username and create a passkey
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="johndoe"
              value={username ?? ""}
              onChange={
                onUsernameChange
                  ? (e) => onUsernameChange(e.target.value)
                  : undefined
              }
              disabled={disabled}
              autoFocus={!!onSubmit}
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pt-6">
          <Button type="submit" className="w-full" disabled={disabled}>
            {isRegistering ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

function RegisterForm() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const registerStart = trpc.auth.registerStart.useMutation();
  const registerFinish = trpc.auth.registerFinish.useMutation();

  async function handleRegister(e: React.SubmitEvent) {
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
      const authenticatorResponse = await startRegistration({
        optionsJSON: options,
      });

      // Step 3: Verify with server and create account
      await registerFinish.mutateAsync({
        authenticatorResponse,
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

  return (
    <RegisterCard
      username={username}
      onUsernameChange={setUsername}
      error={error}
      isRegistering={isRegistering}
      onSubmit={handleRegister}
    />
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterCard />}>
      <RegisterForm />
    </Suspense>
  );
}

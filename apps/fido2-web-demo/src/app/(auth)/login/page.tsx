"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { startAuthentication } from "@simplewebauthn/browser";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
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
  const utils = trpc.useUtils();

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginStart = trpc.auth.loginStart.useMutation();
  const loginFinish = trpc.auth.loginFinish.useMutation();

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
        <Button onClick={handleLogin} className="w-full" disabled={isLoading}>
          {isLoading ? "Authenticating..." : "Sign in with passkey"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Create one
          </Link>
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
          <Link href="/register" className="text-primary hover:underline">
            Create one
          </Link>
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

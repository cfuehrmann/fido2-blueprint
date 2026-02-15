"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { startAuthentication } from "@simplewebauthn/browser";
import { trpc } from "@/lib/trpc";
import { getErrorMessage, toBrowserAuthError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginCard({
  error,
  isLoading,
  onLogin,
}: {
  error?: string | null;
  isLoading?: boolean;
  onLogin?: () => void;
}) {
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
        <Button
          onClick={onLogin}
          className="w-full"
          disabled={isLoading || !onLogin}
        >
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
      const authenticatorResponse = await startAuthentication({
        optionsJSON: options,
      });

      // Step 3: Verify with server (user is identified by credential ID)
      await loginFinish.mutateAsync({
        authenticatorResponse,
      });

      // Invalidate session cache before redirect to prevent race condition
      await utils.auth.session.invalidate();

      // Success - redirect to profile
      router.push("/profile");
    } catch (err) {
      const browserAuthError = toBrowserAuthError(err);
      if (browserAuthError) {
        // Login only sees CANCELLED_OR_DENIED (no ALREADY_REGISTERED possible)
        setError("Cancelled or timed out");
        return;
      }
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <LoginCard error={error} isLoading={isLoading} onLogin={handleLogin} />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginCard />}>
      <LoginForm />
    </Suspense>
  );
}

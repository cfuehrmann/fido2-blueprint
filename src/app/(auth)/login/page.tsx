"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { trpc } from "@/lib/trpc";
import { usernameSchema } from "@/lib/validation";
import { getWebAuthnErrorMessage } from "@/lib/error-utils";
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") ?? "";

  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [copied, setCopied] = useState(false);

  const loginStart = trpc.auth.loginStart.useMutation();
  const loginFinish = trpc.auth.loginFinish.useMutation();
  const registerStart = trpc.auth.registerStart.useMutation();
  const registerFinish = trpc.auth.registerFinish.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Get authentication options from server
      console.log("[Login] Step 1: Calling loginStart...");
      const { options } = await loginStart.mutateAsync({ username });
      console.log("[Login] Step 1 complete: Got options");

      // Step 2: Authenticate with passkey
      console.log("[Login] Step 2: Calling startAuthentication...");
      const credential = await startAuthentication({ optionsJSON: options });
      console.log("[Login] Step 2 complete: Got credential");

      // Step 3: Verify with server (userId comes from session cookie, not client)
      console.log("[Login] Step 3: Calling loginFinish...");
      await loginFinish.mutateAsync({
        credential,
      });
      console.log("[Login] Step 3 complete: Verified");

      // Success - redirect to profile
      console.log("[Login] Success, redirecting...");
      router.push("/profile");
    } catch (err) {
      console.error("[Login] Error caught:", err);
      setError(getWebAuthnErrorMessage(err, "login"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
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
      console.log("[Register] Step 1: Calling registerStart...");
      const { options } = await registerStart.mutateAsync({ username });
      console.log("[Register] Step 1 complete: Got options");

      // Step 2: Create credential with authenticator
      console.log("[Register] Step 2: Calling startRegistration...");
      const credential = await startRegistration({ optionsJSON: options });
      console.log("[Register] Step 2 complete: Got credential");

      // Step 3: Verify with server and create account (userId/username come from session cookie)
      console.log("[Register] Step 3: Calling registerFinish...");
      await registerFinish.mutateAsync({
        credential,
      });
      console.log("[Register] Step 3 complete: Account created");

      // Success - redirect to profile
      console.log("[Register] Success, redirecting...");
      router.push("/profile");
    } catch (err) {
      console.error("[Register] Error caught:", err);
      setError(getWebAuthnErrorMessage(err, "register"));
    } finally {
      setIsRegistering(false);
    }
  }

  function handleCopyError() {
    if (error) {
      navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isDisabled = isLoading || isRegistering;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Use your passkey to sign in securely</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate>
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
            />
          </div>
          {error && (
            <div className="text-sm text-destructive space-y-1">
              <p>{error}</p>
              <button
                type="button"
                onClick={handleCopyError}
                className="text-xs underline opacity-70 hover:opacity-100"
              >
                {copied ? "Copied!" : "Copy error details"}
              </button>
            </div>
          )}
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

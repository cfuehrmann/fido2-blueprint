"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { startRegistration } from "@simplewebauthn/browser"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const registerStart = trpc.auth.registerStart.useMutation()
  const registerFinish = trpc.auth.registerFinish.useMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Step 1: Get registration options from server
      const { options, userId, username: normalizedUsername } =
        await registerStart.mutateAsync({ username })

      // Step 2: Create credential with authenticator
      const credential = await startRegistration({ optionsJSON: options })

      // Step 3: Verify with server and create account
      await registerFinish.mutateAsync({
        userId,
        username: normalizedUsername,
        credential,
      })

      // Success - redirect to profile
      router.push("/profile")
    } catch (err) {
      if (err instanceof Error) {
        // Handle WebAuthn errors
        if (err.name === "NotAllowedError") {
          setError("Passkey creation was cancelled or timed out")
        } else if (err.name === "InvalidStateError") {
          setError("This passkey is already registered")
        } else {
          setError(err.message)
        }
      } else {
        setError("An unexpected error occurred")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Register with a passkey for secure, passwordless authentication
        </CardDescription>
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
              pattern="[a-zA-Z0-9_]+"
              title="Letters, numbers, and underscores only"
              disabled={isLoading}
            />
          </div>
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating passkey..." : "Create passkey"}
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
  )
}

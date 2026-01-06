"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function HomePage() {
  const router = useRouter()
  const { data: session, isLoading } = trpc.auth.session.useQuery()

  useEffect(() => {
    if (session) {
      router.push("/profile")
    }
  }, [session, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (session) {
    return null // Redirecting
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">FIDO2 Blueprint</CardTitle>
          <CardDescription>
            Secure, passwordless authentication with passkeys
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/register">Create Account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: session, isLoading } = trpc.auth.session.useQuery()

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/login")
    }
  }, [session, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null // Redirecting
  }

  return <>{children}</>
}

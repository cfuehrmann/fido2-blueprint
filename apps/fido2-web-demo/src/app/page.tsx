"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

export default function HomePage() {
  const router = useRouter();
  const { data: session, isLoading } = trpc.auth.session.useQuery();

  useEffect(() => {
    if (!isLoading) {
      if (session) {
        router.push("/profile");
      } else {
        router.push("/login");
      }
    }
  }, [session, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

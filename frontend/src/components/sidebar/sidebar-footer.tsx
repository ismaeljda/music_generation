"use client"

import { useEffect, useState } from "react"
import { authClient } from "~/lib/auth-client"
import { SidebarFooter } from "../ui/sidebar"
import { Coins, User, Zap } from "lucide-react"
import { UserButton } from "@daveyplate/better-auth-ui"
import { Button } from "../ui/button"
import Link from "next/link"

export function AppSidebarFooter() {
  const [credits, setCredits] = useState<number | null>(null)
  const { data: session } = authClient.useSession()

  useEffect(() => {
    async function fetchCredits() {
      if (!session?.user?.id) return

      try {
        const response = await fetch('/api/user/credits')
        const data = await response.json()
        setCredits(data.credits)
      } catch (error) {
        console.error('Failed to fetch credits:', error)
      }
    }

    fetchCredits()
  }, [session?.user?.id])

  if (!session?.user) return null

  return (
    <SidebarFooter className="gap-3">
      <div className="flex flex-col gap-2 rounded-lg border bg-white p-3">
        <div className="flex items-center gap-2">
          <Coins className="size-5 text-primary" />
          <div className="flex flex-col flex-1">
            <span className="text-xs text-muted-foreground">Credits</span>
            <span className="text-lg font-bold">
              {credits !== null ? credits : "..."}
            </span>
          </div>
        </div>
        <Button asChild size="sm" className="w-full bg-primary text-white hover:bg-primary/90">
          <Link href="/upgrade">
            <Zap className="size-4 mr-1" />
            Upgrade
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <UserButton
          className="w-full justify-start bg-white hover:bg-gray-50 text-black"
          classNames={{
            trigger: "text-black",
            userName: "text-black",
            userEmail: "text-gray-600"
          }}
          additionalLinks={[
            {
              label: "Customer Portal",
              href: "/customer-portal",
              icon: <User className="size-4" />
            }
          ]}
        />
      </div>
    </SidebarFooter>
  )
}

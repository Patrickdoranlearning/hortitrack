"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchInput({ placeholder, className }: { placeholder?: string; className?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = React.useState(params.get("q") ?? "")

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target as HTMLElement)?.matches("input, textarea")) {
        e.preventDefault()
        const el = document.getElementById("global-search")
        el?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        router.push(`/search?q=${encodeURIComponent(q)}`)
      }}
      className={cn("w-[240px] md:w-[320px]", className)}
    >
      <Input
        id="global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        aria-label="Global search"
      />
    </form>
  )
}
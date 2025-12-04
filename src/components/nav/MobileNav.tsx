"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { APP_NAV } from "@/config/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useState } from "react";

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold" onClick={() => setOpen(false)}>
              <Logo />
            </Link>
          </div>
          <div className="flex-1 overflow-auto">
            <nav className="space-y-2 p-4">
              {APP_NAV.map((module) => {
                const isActive = pathname.startsWith(module.href) || (module.href === "/" && pathname === "/");
                const Icon = module.icon;

                return (
                  <div key={module.key} className="space-y-1">
                    <Link
                      href={module.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                        isActive && "bg-accent"
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      {module.label}
                    </Link>
                    {module.items && module.items.length > 0 && (
                      <div className="ml-6 space-y-1">
                        {module.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                              pathname === item.href && "bg-accent font-medium"
                            )}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

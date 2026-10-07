import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MatchaAppHeaderProps = {
  left: ReactNode;
  right: ReactNode;
  className?: string;
};

/** Shared top-bar shell. Pages supply only their contextual controls. */
export function MatchaAppHeader({ left, right, className }: MatchaAppHeaderProps) {
  return <header className={cn("sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e1e8df] bg-[#f6f8f5]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-10", className)}>
    <div className="min-w-0">{left}</div>
    <div className="ml-4 flex shrink-0 items-center gap-2">{right}</div>
  </header>;
}

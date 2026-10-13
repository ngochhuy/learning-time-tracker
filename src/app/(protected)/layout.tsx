import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MatchaAppShell } from "@/components/matcha-app-shell";
import { getCurrentUser } from "@/lib/current-user";
import { AppError } from "@/lib/errors";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }

  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "false";
  return <MatchaAppShell user={user} developmentBypass={developmentBypass}>{children}</MatchaAppShell>;
}

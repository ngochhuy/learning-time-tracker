import { headers } from "next/headers";
import { auth, isGoogleAuthConfigured } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const developmentBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS !== "false";

  if (developmentBypass) {
    return {
      id: "dev-user",
      name: "Người học",
      email: "dev@learning.local",
    };
  }

  if (!isGoogleAuthConfigured) throw new AppError("UNAUTHORIZED");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new AppError("UNAUTHORIZED");

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}

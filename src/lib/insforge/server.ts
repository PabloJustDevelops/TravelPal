import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/public-env";

export type ServerInsforgeClient = ReturnType<typeof createServerClient>;

export async function createServerInsforgeClient(): Promise<ServerInsforgeClient> {
  return createServerClient({
    baseUrl: publicEnv.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: publicEnv.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: await cookies(),
  });
}

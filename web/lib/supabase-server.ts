import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Server client acting as the signed-in user (RLS applies). For server components, actions and route handlers. */
export async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a server component, where cookies are read-only; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/** The verified current user (checked against Supabase Auth, not just the cookie), or null. */
export async function currentUser() {
  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

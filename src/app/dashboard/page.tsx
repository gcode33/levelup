import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p>
        Signed in as <span className="font-medium">{user.email}</span>
      </p>
      <p>
        Level: <span className="font-medium">{profile?.level_band ?? "Not set"}</span>
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

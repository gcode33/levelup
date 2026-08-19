import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import ResumeForm from "./resume-form";

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

  const hasResume = Boolean(profile?.level_band);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p>
        Signed in as <span className="font-medium">{user.email}</span>
      </p>

      {hasResume ? (
        <section className="flex flex-col gap-2 rounded-xl border border-black/10 p-6">
          <h2 className="text-xl font-medium">Your profile</h2>
          <p>
            Role: <span className="font-medium">{profile.current_title ?? "—"}</span>
          </p>
          <p>
            Level: <span className="font-medium">{profile.level_band}</span>
          </p>
          <p>
            Years experience:{" "}
            <span className="font-medium">{profile.years_exp ?? "—"}</span>
          </p>
          <p>
            Skills:{" "}
            <span className="font-medium">{profile.skills?.join(", ") || "—"}</span>
          </p>
        </section>
      ) : (
        <ResumeForm />
      )}

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

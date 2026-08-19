"use client";

import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { createClient } from "@/lib/supabase/client";

const initialState: AuthState = { error: null, message: null };
const inputCls =
  "rounded border border-black/10 bg-white px-3 py-2 text-black dark:bg-black dark:text-white";

export default function LoginPage() {
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );

  async function signInWithGitHub() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) console.error(error);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <h1 className="text-3xl font-semibold">LevelUp</h1>

      <section className="flex flex-col gap-4 rounded-xl border border-black/10 p-6">
        <h2 className="text-xl font-medium">Sign in</h2>
        <form action={signInAction} className="flex flex-col gap-4">
          <input name="email" type="email" required placeholder="Email" className={inputCls} />
          <input name="password" type="password" required placeholder="Password" className={inputCls} />
          <button
            disabled={signInPending}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Sign in
          </button>
        </form>
        {signInState.error && <p className="text-sm text-red-600">{signInState.error}</p>}
      </section>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-black/10" />
        <span className="text-sm text-zinc-500">or</span>
        <div className="h-px flex-1 bg-black/10" />
      </div>

      <button
        onClick={signInWithGitHub}
        className="rounded border border-black/10 px-4 py-2 text-sm font-medium"
      >
        Continue with GitHub
      </button>

      <section className="flex flex-col gap-4 rounded-xl border border-black/10 p-6">
        <h2 className="text-xl font-medium">Sign up</h2>
        <form action={signUpAction} className="flex flex-col gap-4">
          <input name="email" type="email" required placeholder="Email" className={inputCls} />
          <input name="password" type="password" required placeholder="Password" className={inputCls} />
          <button
            disabled={signUpPending}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Sign up
          </button>
        </form>
        {signUpState.error && <p className="text-sm text-red-600">{signUpState.error}</p>}
        {signUpState.message && <p className="text-sm text-blue-600">{signUpState.message}</p>}
      </section>
    </main>
  );
}

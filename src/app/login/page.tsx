"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { createClient } from "@/lib/supabase/client";

const initialState: AuthState = { error: null, message: null };
const inputCls =
  "input";

export default function LoginPage() {
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );

  const [oauthError, setOauthError] = useState<string | null>(null);

  async function signInWithGitHub() {
    setOauthError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setOauthError(error.message);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-4xl font-bold text-transparent">
          LevelUp
        </h1>
        <p className="text-sm text-zinc-500">
          Turn your resume into a personalized, game-like career roadmap.
        </p>
      </div>

      <section className="flex flex-col gap-4 card p-6">
        <h2 className="text-xl font-medium">Sign in</h2>
        <form action={signInAction} className="flex flex-col gap-4">
          <input name="email" type="email" required placeholder="Email" className={inputCls} />
          <input name="password" type="password" required placeholder="Password" className={inputCls} />
          <button
            disabled={signInPending}
            className="btn-primary"
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
        className="btn-ghost w-full"
      >
        Continue with GitHub
      </button>
      {oauthError && (
        <p className="text-sm text-red-600">GitHub sign-in failed: {oauthError}</p>
      )}

      <section className="flex flex-col gap-4 card p-6">
        <h2 className="text-xl font-medium">Sign up</h2>
        <form action={signUpAction} className="flex flex-col gap-4">
          <input name="email" type="email" required placeholder="Email" className={inputCls} />
          <input name="password" type="password" required placeholder="Password" className={inputCls} />
          <button
            disabled={signUpPending}
            className="btn-primary"
          >
            Sign up
          </button>
        </form>
        {signUpState.error && <p className="text-sm text-red-600">{signUpState.error}</p>}
        {signUpState.message && <p className="text-sm text-indigo-600">{signUpState.message}</p>}
      </section>
    </main>
  );
}

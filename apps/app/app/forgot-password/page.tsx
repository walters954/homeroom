"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const result = await requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {sent ? (
        <p className="max-w-sm text-center text-sm text-dim">
          If an account exists for that address, a reset link is on its way.
          Check your inbox.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-sm flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              required
              className="rounded-md border border-line px-3 py-2 font-normal"
            />
          </label>
          {error && <p className="text-sm text-fail">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-acc px-4 py-2 text-sm font-medium text-acc-ink hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <Link href="/sign-in" className="text-sm text-dim underline">
        Back to sign in
      </Link>
    </main>
  );
}

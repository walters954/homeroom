"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { resetPassword } from "@/lib/auth-client";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <p className="max-w-sm text-center text-sm text-dim">
        This reset link is missing its token or has expired.{" "}
        <Link href="/forgot-password" className="underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    router.push("/sign-in?reset=1");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        New password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-line px-3 py-2 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Confirm password
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-line px-3 py-2 font-normal"
        />
      </label>
      {error && <p className="text-sm text-fail">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-acc px-4 py-2 text-sm font-medium text-acc-ink hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </main>
  );
}

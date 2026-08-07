import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <AuthForm mode="sign-in" />
      <p className="text-sm text-zinc-500">
        <Link href="/forgot-password" className="underline">
          Forgot your password?
        </Link>
      </p>
      <p className="text-sm text-zinc-500">
        No account?{" "}
        <Link href="/sign-up" className="underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}

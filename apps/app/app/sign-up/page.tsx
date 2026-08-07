import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <AuthForm mode="sign-up" />
      <p className="text-sm text-dim">
        Already have an account?{" "}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

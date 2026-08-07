import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function SiteNav() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-zinc-200">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold tracking-tight">
            Homeroom
          </Link>
          <Link href="/courses" className="text-sm text-zinc-600 hover:text-zinc-900">
            Courses
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-900">
              Admin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="text-zinc-500">{user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="text-zinc-600 hover:text-zinc-900">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      title="Sign out"
      aria-label="Sign out"
      className="grid h-[31px] w-[31px] place-items-center rounded-[7px] text-[13px] text-dim hover:bg-soft"
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
    >
      ⎋
    </button>
  );
}

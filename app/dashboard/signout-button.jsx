"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground hover:text-background"
    >
      Logout
    </button>
  );
}

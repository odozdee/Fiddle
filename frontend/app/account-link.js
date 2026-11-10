"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";

export default function AccountLink() {
  const { user, loading } = useAuth();
  return <Link href={user ? "/account" : "/login"} aria-busy={loading}>{user ? "My account" : "Sign in"}</Link>;
}

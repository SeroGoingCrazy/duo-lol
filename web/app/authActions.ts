"use server";
import { signIn, signOut } from "@/auth";

export async function signInWithDiscord() {
  await signIn("discord", { redirectTo: "/account" });
}

export async function signOutNow() {
  await signOut({ redirectTo: "/" });
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminToken, checkPassword } from "@/lib/admin";

async function login(form: FormData) {
  "use server";
  if (!checkPassword(String(form.get("password") ?? ""))) redirect("/admin/login?error=1");
  cookies().set(ADMIN_COOKIE, adminToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  redirect("/admin");
}

export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <form action={login} className="card" style={{ maxWidth: 360 }}>
      <h1>Owner login</h1>
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required autoFocus />
      {searchParams.error && <p className="error">Wrong password.</p>}
      <p><button className="btn">Log in</button></p>
    </form>
  );
}

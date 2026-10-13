import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const adminCookie = "big_iron_admin_session";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const equals = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x,y);
};
export function encodePassword(password: string) {
  const salt = randomBytes(24).toString("hex");
  return { salt, password_hash: scryptSync(password,salt,64).toString("hex") };
}
export function comparePassword(password: string, salt: string, hash: string) {
  try { return equals(scryptSync(password,salt,64).toString("hex"),hash); } catch { return false; }
}
export function ownerPasswordMatches(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  return !!expected && equals(password,expected);
}
export async function createSession(passwordId: string | null) {
  const token = randomBytes(32).toString("hex");
  const { error } = await supabaseAdmin.from("admin_sessions").insert({
    password_id: passwordId, token_hash: sha(token),
    expires_at: new Date(Date.now()+12*60*60*1000).toISOString()
  });
  if (error) throw new Error(error.message);
  return token;
}
export async function getSession(request: NextRequest): Promise<{role:"owner"|"staff"} | null> {
  const cookie=request.cookies.get(adminCookie)?.value;
  if (!cookie) return null;
  const {data,error}=await supabaseAdmin.from("admin_sessions")
    .select("password_id, expires_at").eq("token_hash",sha(cookie))
    .gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error||!data) return null;
  if(data.password_id===null) return {role:"owner"};
  const {data:password,error:passwordError}=await supabaseAdmin.from("admin_passwords")
    .select("enabled").eq("id",data.password_id).maybeSingle();
  if(passwordError||!password?.enabled) return null;
  return {role:"staff"};
}
export async function isOwner(request:NextRequest) { return (await getSession(request))?.role==="owner"; }

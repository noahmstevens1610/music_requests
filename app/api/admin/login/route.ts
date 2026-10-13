import {NextRequest,NextResponse} from "next/server";
import {adminCookie,createSession,ownerPasswordMatches,comparePassword} from "@/lib/admin-session";
import {supabaseAdmin} from "@/lib/supabase-admin";
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>({}));
 if(typeof body.password!=="string"||!body.password) return NextResponse.json({error:"Password required"},{status:400});
 let passwordId:string|null=null;
 if(!ownerPasswordMatches(body.password)){
   const {data,error}=await supabaseAdmin.from("admin_passwords").select("id,salt,password_hash,enabled").eq("enabled",true);
   if(error) return NextResponse.json({error:"Login unavailable"},{status:500});
   const match=(data??[]).find(p=>comparePassword(body.password,p.salt,p.password_hash));
   if(!match) return NextResponse.json({error:"Incorrect password"},{status:401});
   passwordId=match.id;
 }
 try{
   const token=await createSession(passwordId);
   const res=NextResponse.json({success:true,role:passwordId===null?"owner":"staff"});
   res.cookies.set(adminCookie,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:43200});
   return res;
 }catch{return NextResponse.json({error:"Could not create session. Verify database migration."},{status:500});}
}

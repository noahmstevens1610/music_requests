import {NextRequest,NextResponse} from "next/server";
import {isOwner,encodePassword} from "@/lib/admin-session";
import {supabaseAdmin} from "@/lib/supabase-admin";
const forbidden=()=>NextResponse.json({error:"Owner access required"},{status:403});
export async function GET(req:NextRequest){
 if(!await isOwner(req)) return forbidden();
 const {data,error}=await supabaseAdmin.from("admin_passwords").select("id,name,enabled,created_at").order("created_at",{ascending:false});
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({passwords:data});
}
export async function POST(req:NextRequest){
 if(!await isOwner(req)) return forbidden();
 const b=await req.json().catch(()=>({}));
 if(typeof b.name!=="string"||!b.name.trim()||b.name.length>80||typeof b.password!=="string"||b.password.length<12||b.password.length>256)
 return NextResponse.json({error:"Name and password (12–256 characters) required"},{status:400});
 const {data,error}=await supabaseAdmin.from("admin_passwords").insert({name:b.name.trim(),...encodePassword(b.password),enabled:true}).select("id,name,enabled,created_at").single();
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({password:data},{status:201});
}
export async function PATCH(req:NextRequest){
 if(!await isOwner(req)) return forbidden();
 const b=await req.json().catch(()=>({}));
 if(typeof b.id!=="string"||typeof b.enabled!=="boolean")return NextResponse.json({error:"Invalid input"},{status:400});
 const {error}=await supabaseAdmin.from("admin_passwords").update({enabled:b.enabled}).eq("id",b.id);
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({success:true});
}
export async function DELETE(req:NextRequest){
 if(!await isOwner(req)) return forbidden();
 const b=await req.json().catch(()=>({}));
 if(typeof b.id!=="string")return NextResponse.json({error:"Invalid input"},{status:400});
 const {error}=await supabaseAdmin.from("admin_passwords").delete().eq("id",b.id);
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({success:true});
}

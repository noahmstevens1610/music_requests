import { NextRequest, NextResponse } from "next/server";
import { isOwner, ownerPasswordMatches } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSpotifyAccessToken } from "@/lib/spotify";
const denied=()=>NextResponse.json({error:"Owner authentication required"},{status:403});
const valid=(b:unknown):b is {ownerPassword:string}=>typeof b==="object"&&b!==null&&"ownerPassword" in b&&typeof (b as {ownerPassword:unknown}).ownerPassword==="string"&&ownerPasswordMatches((b as {ownerPassword:string}).ownerPassword);
export async function GET(req:NextRequest){
 if(!await isOwner(req))return denied();
 const {data,error}=await supabaseAdmin.from("spotify_accounts").select("slot,spotify_user_id,display_name,active,updated_at").order("slot");
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({accounts:data??[]});
}
export async function POST(req:NextRequest){
 if(!await isOwner(req))return denied();
 const b=await req.json().catch(()=>null);
 if(!valid(b)||typeof (b as {slot?:unknown}).slot!=="number")return denied();
 const slot=(b as {slot:number}).slot;
 if(slot!==1&&slot!==2)return NextResponse.json({error:"Invalid account slot"},{status:400});
 const {data,error}=await supabaseAdmin.from("spotify_accounts").select("slot").eq("slot",slot).maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});
 if(!data)return NextResponse.json({error:"Slot is empty"},{status:404});
 try{await getSpotifyAccessToken(slot);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Account is not ready"},{status:400});}
 // First disable the old slot; if activating the new one fails, restore the previous one.
 const {data:old}=await supabaseAdmin.from("spotify_accounts").select("slot").eq("active",true).maybeSingle();
 if(old?.slot===slot)return NextResponse.json({success:true});
 const {error:off}=await supabaseAdmin.from("spotify_accounts").update({active:false}).eq("active",true);
 if(off)return NextResponse.json({error:off.message},{status:500});
 const {error:on}=await supabaseAdmin.from("spotify_accounts").update({active:true}).eq("slot",slot);
 if(on){if(old)await supabaseAdmin.from("spotify_accounts").update({active:true}).eq("slot",old.slot);return NextResponse.json({error:on.message},{status:500});}
 return NextResponse.json({success:true});
}
export async function DELETE(req:NextRequest){
 if(!await isOwner(req))return denied();
 const b=await req.json().catch(()=>null);
 if(!valid(b)||typeof (b as {slot?:unknown}).slot!=="number")return denied();
 const slot=(b as {slot:number}).slot;
 if(slot!==1&&slot!==2)return NextResponse.json({error:"Invalid slot"},{status:400});
 const {data}=await supabaseAdmin.from("spotify_accounts").select("active").eq("slot",slot).maybeSingle();
 if(data?.active)return NextResponse.json({error:"Switch to another account before removing the active account"},{status:409});
 const {error}=await supabaseAdmin.from("spotify_accounts").delete().eq("slot",slot);
 return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({success:true});
}

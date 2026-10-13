import { NextRequest, NextResponse } from "next/server";
import { isOwner, ownerPasswordMatches } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSpotifyAccessToken } from "@/lib/spotify";

export async function POST(req: NextRequest) {
 if (!(await isOwner(req))) return NextResponse.json({error:"Owner access required"},{status:403});
 const body = await req.json().catch(()=>({}));
 if (!ownerPasswordMatches(body.ownerPassword)) return NextResponse.json({error:"Incorrect owner password"},{status:403});
 const {data:existing,error:slotError}=await supabaseAdmin.from("spotify_accounts").select("slot").eq("slot",1).maybeSingle();
 if(slotError)return NextResponse.json({error:slotError.message},{status:500});
 if(existing)return NextResponse.json({error:"Slot 1 already has an account. Remove or replace it first."},{status:409});
 const {data:legacy,error:legacyError}=await supabaseAdmin.from("spotify_tokens")
  .select("access_token,refresh_token,expires_at").eq("id",1).maybeSingle();
 if(legacyError||!legacy?.refresh_token)return NextResponse.json({error:"No legacy Spotify connection found"},{status:404});
 let accessToken:string;
 try {accessToken=await getSpotifyAccessToken();}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Legacy token expired"},{status:400});}
 const {data:latestLegacy,error:latestError}=await supabaseAdmin.from("spotify_tokens").select("access_token,refresh_token,expires_at").eq("id",1).maybeSingle();
 if(latestError||!latestLegacy?.refresh_token)return NextResponse.json({error:"Unable to reload updated legacy credentials"},{status:500});
 const me=await fetch("https://api.spotify.com/v1/me",{headers:{Authorization:"Bearer "+accessToken},cache:"no-store"});
 if(!me.ok)return NextResponse.json({error:"Spotify identity check failed. Reconnect the account."},{status:400});
 const profile=await me.json();
 if(typeof profile.id!=="string")return NextResponse.json({error:"Invalid account profile"},{status:400});
 const {data:duplicate}=await supabaseAdmin.from("spotify_accounts").select("slot").eq("spotify_user_id",profile.id).maybeSingle();
 if(duplicate)return NextResponse.json({error:"This account is already in another slot"},{status:409});
 const {data:active}=await supabaseAdmin.from("spotify_accounts").select("slot").eq("active",true).maybeSingle();
 const {error}=await supabaseAdmin.from("spotify_accounts").insert({
  slot:1, spotify_user_id:profile.id,display_name:profile.display_name||profile.id,
  access_token:latestLegacy.access_token||accessToken,refresh_token:latestLegacy.refresh_token,
  expires_at:latestLegacy.expires_at??new Date(Date.now()+300000).toISOString(),
  active:!active,updated_at:new Date().toISOString()
 });
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({success:true,displayName:profile.display_name||profile.id});
}

import { supabaseAdmin } from "@/lib/supabase-admin";
type TokenRow={slot?:number;access_token:string|null;refresh_token:string|null;expires_at:string|null};
export async function getSpotifyAccessToken(slot?:number):Promise<string>{
 // Old single-account records remain usable until a new account is activated.
 const query=supabaseAdmin.from("spotify_accounts").select("slot,access_token,refresh_token,expires_at");
 const {data,error}=await (slot?query.eq("slot",slot):query.eq("active",true)).maybeSingle<TokenRow>();
 if(error)throw new Error("Could not load Spotify accounts: "+error.message);
 if(data)return validToken(data,"spotify_accounts",data.slot!);
 if(slot)throw new Error("Spotify account slot is not connected");
 const legacy=await supabaseAdmin.from("spotify_tokens").select("access_token,refresh_token,expires_at").eq("id",1).maybeSingle<TokenRow>();
 if(legacy.error)throw new Error("Could not load legacy Spotify account: "+legacy.error.message);
 if(!legacy.data)throw new Error("Spotify is not connected");
 return validToken(legacy.data,"spotify_tokens",1);
}
async function validToken(row:TokenRow,table:"spotify_accounts"|"spotify_tokens",id:number):Promise<string>{
 if(!row.refresh_token)throw new Error("Spotify needs to be reconnected");
 if(row.access_token&&new Date(row.expires_at??0).getTime()>Date.now()+60000)return row.access_token;
 const clientId=process.env.SPOTIFY_CLIENT_ID,secret=process.env.SPOTIFY_CLIENT_SECRET;
 if(!clientId||!secret)throw new Error("Spotify credentials missing");
 const res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{Authorization:"Basic "+Buffer.from(clientId+":"+secret).toString("base64"),"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:row.refresh_token}),cache:"no-store"});
 const tokens=await res.json();
 if(!res.ok||!tokens.access_token)throw new Error("Could not refresh Spotify token. Reconnect the account.");
 const {error}=await supabaseAdmin.from(table).update({access_token:tokens.access_token,refresh_token:tokens.refresh_token??row.refresh_token,expires_at:new Date(Date.now()+tokens.expires_in*1000).toISOString(),updated_at:new Date().toISOString()}).eq(table==="spotify_accounts"?"slot":"id",id).eq("refresh_token",row.refresh_token);
 if(error)throw new Error("Could not save Spotify refresh: "+error.message);
 return tokens.access_token;
}

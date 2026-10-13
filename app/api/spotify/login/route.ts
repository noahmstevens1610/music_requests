import {randomBytes} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {isOwner,ownerPasswordMatches} from "@/lib/admin-session";
export async function POST(req:NextRequest){
 if(!await isOwner(req))return NextResponse.json({error:"Owner access required"},{status:403});
 const b=await req.json().catch(()=>({}));
 if(!ownerPasswordMatches(b.ownerPassword))return NextResponse.json({error:"Invalid owner password"},{status:403});
 if(b.slot!==1&&b.slot!==2)return NextResponse.json({error:"Choose account slot 1 or 2"},{status:400});
 const clientId=process.env.SPOTIFY_CLIENT_ID,redirectUri=process.env.SPOTIFY_REDIRECT_URI;
 if(!clientId||!redirectUri)return NextResponse.json({error:"Spotify environment variables are missing"},{status:500});
 const state=randomBytes(24).toString("hex");
 const url=new URL("https://accounts.spotify.com/authorize");
 url.searchParams.set("response_type","code");url.searchParams.set("client_id",clientId);
 url.searchParams.set("scope",["playlist-modify-public","playlist-modify-private","user-read-currently-playing","user-read-recently-played","user-read-playback-state","user-modify-playback-state","user-read-private"].join(" "));
 url.searchParams.set("redirect_uri",redirectUri);url.searchParams.set("state",state);url.searchParams.set("show_dialog","true");
 const res=NextResponse.json({authorizeUrl:url.toString()});
 res.cookies.set("spotify_oauth_state",state,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:600,path:"/"});
 res.cookies.set("spotify_oauth_slot",String(b.slot),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:600,path:"/"});
 return res;
}

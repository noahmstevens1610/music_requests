import {NextRequest,NextResponse} from "next/server";
import {getSession} from "@/lib/admin-session";
export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==="/admin/login"||path==="/api/admin/login")return NextResponse.next();
 const session=await getSession(request);
 if(!session){
   if(path.startsWith("/api/"))return NextResponse.json({error:"Unauthorized"},{status:401});
   const url=new URL("/admin/login",request.url);
   url.searchParams.set("next",path+request.nextUrl.search);
   return NextResponse.redirect(url);
 }
 if(session.role!=="owner"&&(path.startsWith("/admin/settings")||path.startsWith("/api/admin/passwords")||path.startsWith("/api/admin/spotify-accounts")||path.startsWith("/api/spotify/login")||path.startsWith("/api/spotify/callback"))){
   return NextResponse.json({error:"Owner access required"},{status:403});
 }
 return NextResponse.next();
}
export const config={matcher:["/admin/:path*","/api/admin/:path*","/api/spotify/login","/api/spotify/callback"]};

import {NextRequest,NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabase-admin";
export async function GET(req:NextRequest){
 const event=req.nextUrl.searchParams.get("event");
 let query=supabaseAdmin.from("requests").select("id,event_id,track_name,artist_name,request_type,status,votes,created_at");
 if(event)query=query.eq("event_id",event);
 const {data,error}=await query.limit(10000);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const rows=data??[];
 const totalVotes=rows.reduce((n,r)=>n+(r.votes??0),0);
 const top=new Map<string,{name:string;artist:string;requests:number;votes:number}>();
 for(const r of rows){const key=r.track_name+"\u0000"+r.artist_name;const x=top.get(key)??{name:r.track_name,artist:r.artist_name,requests:0,votes:0};x.requests++;x.votes+=r.votes??0;top.set(key,x);}
 const byDay:Record<string,number>={};
 for(const r of rows){const day=String(r.created_at).slice(0,10);byDay[day]=(byDay[day]??0)+1;}
 return NextResponse.json({totalRequests:rows.length,totalVotes,swingRequests:rows.filter(x=>x.request_type==="swing").length,lineDanceRequests:rows.filter(x=>x.request_type==="line_dance").length,played:rows.filter(x=>x.status==="played").length,byDay,topSongs:[...top.values()].sort((a,b)=>b.requests-a.requests||b.votes-a.votes).slice(0,15),note:rows.length===10000?"Results limited to 10,000 requests":null});
}

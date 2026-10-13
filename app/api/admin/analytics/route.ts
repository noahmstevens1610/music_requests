import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RequestRecord = {
 id: string; event_id: string; track_name: string; artist_name: string;
 request_type: string; status: string | null; votes: number | null; created_at: string
};
async function fetchRows(table: "requests" | "request_history", event?: string) {
 const result: RequestRecord[] = [];
 for (let start = 0; start < 100000; start += 1000) {
  let query = supabaseAdmin.from(table)
   .select("event_id, track_name, artist_name, request_type, status, votes, created_at")
   .range(start, start + 999);
  // History has request_id instead of id; only selected common fields are needed.
  if (event) query = query.eq("event_id", event);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  result.push(...((data ?? []) as unknown as RequestRecord[]));
  if ((data ?? []).length < 1000) break;
 }
 return result;
}
export async function GET(req: NextRequest) {
 const event = req.nextUrl.searchParams.get("event") ?? undefined;
 try {
  const rows: RequestRecord[] = [];
  for (const table of ["requests", "request_history"] as const) {
   const records = await fetchRows(table, event);
   rows.push(...records);
  }
  const top = new Map<string, {name:string;artist:string;requests:number;votes:number}>();
  const byDay: Record<string,number> = {};
  for (const r of rows) {
   const key = r.track_name + "\u0000" + r.artist_name;
   const item = top.get(key) ?? {name:r.track_name,artist:r.artist_name,requests:0,votes:0};
   item.requests++;item.votes+=r.votes??0;top.set(key,item);
   const day = r.created_at.slice(0,10);
   byDay[day]=(byDay[day]??0)+1;
  }
  return NextResponse.json({
   totalRequests:rows.length,
   totalVotes:rows.reduce((sum,r)=>sum+(r.votes??0),0),
   swingRequests:rows.filter(r=>r.request_type==="swing").length,
   lineDanceRequests:rows.filter(r=>r.request_type==="line_dance").length,
   played:rows.filter(r=>r.status==="played").length,
   byDay,
   topSongs:[...top.values()].sort((a,b)=>b.requests-a.requests||b.votes-a.votes).slice(0,15),
   note:rows.length >= 100000?"Large-history pagination should be reviewed":null
  });
 } catch(e) {
  return NextResponse.json({error:e instanceof Error?e.message:"Analytics unavailable"},{status:500});
 }
}

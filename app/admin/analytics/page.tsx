"use client";
import {useEffect,useState} from "react";
type Analytics={totalRequests:number;totalVotes:number;swingRequests:number;lineDanceRequests:number;played:number;byDay:Record<string,number>;topSongs:{name:string;artist:string;requests:number;votes:number}[];note:string|null};
export default function AnalyticsPage(){
 const [data,setData]=useState<Analytics|null>(null),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/admin/analytics",{cache:"no-store"}).then(async r=>{const json=await r.json();if(!r.ok)throw new Error(json.error);setData(json)}).catch(e=>setError(e.message))},[]);
 const stats=data?[["Song requests",data.totalRequests],["Total votes",data.totalVotes],["Swing requests",data.swingRequests],["Line dance requests",data.lineDanceRequests],["Played requests",data.played]]:[];
 return <main className="min-h-screen bg-[#0d0d0d] text-white p-6 sm:p-10"><div className="max-w-5xl mx-auto space-y-8">
 <a className="text-red-400" href="/admin">← Admin</a><h1 className="text-3xl font-bold">Request Analytics</h1>
 <p className="text-white/60">Statistics from requests still stored in Supabase. Previously reset events are not included.</p>
 {error&&<p className="text-red-400">{error}</p>}{!data&&!error&&<p>Loading analytics…</p>}
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{stats.map(([title,value])=><div key={title} className="border border-white/20 rounded-lg p-5"><div className="text-white/60 text-sm">{title}</div><div className="text-3xl font-bold mt-2">{value}</div></div>)}</div>
 {data&&<><h2 className="text-xl font-bold">Daily requests</h2><div className="space-y-2">{Object.entries(data.byDay).sort().slice(-30).map(([day,n])=><div key={day} className="flex gap-3 items-center"><span className="w-28 text-sm">{day}</span><div className="h-4 bg-[#c4202f]" style={{width:`${Math.max(1,100*n/Math.max(1,...Object.values(data.byDay)))}%`}}/><span>{n}</span></div>)}</div>
 <h2 className="text-xl font-bold">Most requested songs</h2><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-3">Song</th><th>Requests</th><th>Votes</th></tr></thead><tbody>{data.topSongs.map(s=><tr key={s.name+s.artist} className="border-t border-white/10"><td className="p-3">{s.name} — {s.artist}</td><td>{s.requests}</td><td>{s.votes}</td></tr>)}</tbody></table></div>
 {data.note&&<p className="text-amber-300">{data.note}</p>}</>}
 </div></main>;
}

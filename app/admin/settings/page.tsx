"use client";
import {useEffect,useState} from "react";
type Entry={id:string;name:string;enabled:boolean};
export default function Settings(){
 const [items,setItems]=useState<Entry[]>([]);
 const [name,setName]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function load(){const r=await fetch("/api/admin/passwords",{cache:"no-store"});if(r.ok)setItems((await r.json()).passwords??[]);else setError("Owner access required or password database not configured.");}
 useEffect(()=>{void load()},[]);
 async function add(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");
 const r=await fetch("/api/admin/passwords",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,password})});
 if(!r.ok)setError((await r.json()).error??"Could not add password");else{setName("");setPassword("");await load()}setBusy(false);}
 async function action(method:"PATCH"|"DELETE",id:string,enabled?:boolean){setError("");
 const r=await fetch("/api/admin/passwords",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({id,enabled})});
 if(!r.ok)setError((await r.json()).error??"Update failed");else await load();}
 return <main className="min-h-screen bg-[#0d0d0d] text-white p-6 sm:p-10"><div className="max-w-3xl mx-auto space-y-8">
 <a href="/admin" className="text-red-400">← Admin</a><h1 className="text-3xl font-bold">Admin Settings</h1>
 <section className="rounded-xl border border-white/20 p-5 space-y-4"><h2 className="text-xl font-bold">Shared access passwords</h2>
 <p className="text-white/60 text-sm">Disable a password to immediately revoke every session using it. Your owner password is managed separately in Vercel.</p>
 {items.map(p=><div className="flex gap-3 items-center justify-between border-b border-white/10 py-3" key={p.id}>
 <div><div className="font-semibold">{p.name}</div><span className="text-sm text-white/60">{p.enabled?"Enabled":"Disabled"}</span></div>
 <div className="flex gap-2"><button className="border border-white/30 rounded px-3 py-2" onClick={()=>action("PATCH",p.id,!p.enabled)}>{p.enabled?"Disable":"Enable"}</button>
 <button className="text-red-400 border border-red-400/40 rounded px-3 py-2" onClick={()=>{if(confirm("Delete this password and revoke its sessions?"))void action("DELETE",p.id)}}>Delete</button></div></div>)}
 <form onSubmit={add} className="space-y-3"><h3 className="font-bold">Add shared password</h3>
 <input required maxLength={80} placeholder="Label (e.g. Event staff)" className="block w-full bg-black border border-white/30 p-3 rounded" value={name} onChange={e=>setName(e.target.value)}/>
 <input required type="password" minLength={12} maxLength={256} autoComplete="new-password" placeholder="New password (12+ characters)" className="block w-full bg-black border border-white/30 p-3 rounded" value={password} onChange={e=>setPassword(e.target.value)}/>
 <button disabled={busy} className="bg-[#c4202f] px-5 py-3 rounded font-bold">Create password</button></form></section>
 {error&&<p role="alert" className="text-red-400">{error}</p>}
 <section className="rounded-xl border border-white/20 p-5 space-y-3"><h2 className="text-xl font-bold">Spotify accounts</h2><p className="text-white/60">Owner-only two-account management will appear here after the Spotify migration and switching endpoints are in place.</p></section>
 </div></main>;
}

"use client";
import {useEffect,useState} from "react";
type Entry={id:string;name:string;enabled:boolean};
type SpotifyAccount={slot:number;spotify_user_id:string;display_name:string;active:boolean};
export default function Settings(){
 const [items,setItems]=useState<Entry[]>([]);
 const [spotify,setSpotify]=useState<SpotifyAccount[]>([]);
 const [ownerPassword,setOwnerPassword]=useState("");
 const [spotifyMessage,setSpotifyMessage]=useState("");
 const [name,setName]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function load(){const r=await fetch("/api/admin/passwords",{cache:"no-store"});if(r.ok)setItems((await r.json()).passwords??[]);else setError("Owner access required or password database not configured.");}
 async function loadSpotify(){const r=await fetch("/api/admin/spotify-accounts",{cache:"no-store"});if(r.ok)setSpotify((await r.json()).accounts??[]);}
 useEffect(()=>{void load();void loadSpotify()},[]);
 async function spotifyAction(action:"connect"|"switch"|"remove",slot:number){
 setSpotifyMessage("");
 if(!ownerPassword){setSpotifyMessage("Enter your owner password first.");return;}
 const url=action==="connect"?"/api/spotify/login":"/api/admin/spotify-accounts";
 const method=action==="remove"?"DELETE":"POST";
 const res=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({slot,ownerPassword})});
 const body=await res.json();
 if(!res.ok){setSpotifyMessage(body.error??"Operation failed");return;}
 setOwnerPassword("");
 if(action==="connect"){window.location.assign(body.authorizeUrl);return;}
 setSpotifyMessage(action==="switch"?"Active Spotify account updated.":"Account removed.");await loadSpotify();
 }
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
 <section className="rounded-xl border border-white/20 p-5 space-y-4"><h2 className="text-xl font-bold">Spotify accounts (maximum 2)</h2><p className="text-white/60 text-sm">Enter the owner password before connecting, switching or removing an account. Changing accounts does not transfer the Spotify playback queue.</p><input type="password" autoComplete="current-password" placeholder="Owner admin password" value={ownerPassword} onChange={e=>setOwnerPassword(e.target.value)} className="block w-full bg-black border border-white/30 p-3 rounded"/>{[1,2].map(slot=>{const account=spotify.find(a=>a.slot===slot);return <div key={slot} className="border-t border-white/10 pt-4 flex flex-wrap gap-3 items-center justify-between"><div><strong>Account {slot}</strong><div className="text-sm text-white/60">{account?account.display_name:"Not connected"} {account?.active?"· Active":""}</div></div><div className="flex flex-wrap gap-2">{account?<><button className="border border-white/30 px-3 py-2 rounded" disabled={account.active} onClick={()=>spotifyAction("switch",slot)}>Switch to this account</button><button className="border border-white/30 px-3 py-2 rounded" onClick={()=>spotifyAction("connect",slot)}>Reconnect / Replace</button><button className="border border-red-500/50 text-red-400 px-3 py-2 rounded" disabled={account.active} onClick={()=>{if(confirm("Remove this Spotify account?"))void spotifyAction("remove",slot)}}>Remove</button></>:<button className="bg-[#c4202f] px-4 py-2 rounded" onClick={()=>spotifyAction("connect",slot)}>Connect account</button>}</div></div>})}{spotifyMessage&&<p role="status" className="text-amber-200">{spotifyMessage}</p>}</section>
 </div></main>;
}

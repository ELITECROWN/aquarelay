import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Notice,useRecord } from './workflowShared';
export default function KnowledgeSearch({id}:{id:string}) {
 const [query,setQuery]=useState(''),[search,setSearch]=useState('');
 const records=useRecord<{answer:string;records:{id:string;title:string;description:string;kind:string;href:string;synthetic:boolean}[]}>(`/api/v1/waterbodies/${id}/knowledge?q=${encodeURIComponent(search)}`,!!search);
 return <section className="wf-panel"><h2>Find historical records</h2><form onSubmit={e=>{e.preventDefault();setSearch(query.trim());}}><label className="wf-field">Search this water body's records<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={500} placeholder="For example: cleanup, fish, temperature"/></label><button className="wf-button">Find records</button></form>{records.error&&<Notice error>{records.error}</Notice>}{records.data&&<><p>{records.data.answer}</p>{records.data.records.map(r=><article className="wf-record" key={r.kind+r.id}><div><Link to={r.href}>{r.title}</Link><p>{r.description}</p><small>{r.kind} · record {r.id}{r.synthetic?' · synthetic demonstration':''}</small></div></article>)}</>}</section>;
}

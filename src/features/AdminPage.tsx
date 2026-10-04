import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useSession} from '../session';
import {useRecord,Loading,Notice,WorkflowHeader,date,label} from './workflowShared';

type Row={id:string;name:string;detail:string;status:string;created_at:string;size?:number;email_verified?:boolean;case_id?:string;waterbody_id?:string};
const kinds=['accounts','reports','incidents','waterbodies','uploads'] as const;
export default function AdminPage(){
 const {user,loading}=useSession();const admin=user?.role==='admin';
 const [kind,setKind]=useState<typeof kinds[number]>('reports');
 const [search,setSearch]=useState('');const [query,setQuery]=useState('');const [page,setPage]=useState(1);
 const summary=useRecord<{counts:Record<string,number>}>('/api/v1/admin/records/summary',admin);
 const records=useRecord<{items:Row[];total:number;page_size:number}>(`/api/v1/admin/records?kind=${kind}&page=${page}&q=${encodeURIComponent(query)}`,admin);
 if(loading)return <Loading/>;
 if(!admin)return <div className="wf-page"><h1>Administrator access required</h1><p>Sign in with the owner email and verify the emailed code to access database records.</p><Link className="wf-button" to="/login?admin=1">Sign in as administrator</Link></div>;
 return <div className="wf-page"><WorkflowHeader eyebrow="Owner administration" title="Database & records" description="Inspect saved records and account information."><Link className="wf-button" to="/admin/cleanup">Prototype data cleanup</Link><Link className="wf-button" to="/registry">Manage registry</Link></WorkflowHeader>
 <div className="wf-workspace-tiles">{Object.entries(summary.data?.counts||{}).map(([name,count])=><div className="wf-panel" key={name}><h3>{label(name)}</h3><strong>{count.toLocaleString('en-IN')}</strong></div>)}</div>
 {summary.error&&<Notice error>{summary.error}<button onClick={summary.reload}>Retry counts</button></Notice>}
 <section className="wf-panel"><div className="button-row" role="group" aria-label="Record categories">{kinds.map(value=><button className={`wf-button ${kind===value?'primary':''}`} aria-pressed={kind===value} key={value} onClick={()=>{setKind(value);setPage(1);}}>{label(value)}</button>)}</div>
 <form className="form-stack" onSubmit={e=>{e.preventDefault();setPage(1);setQuery(search.trim());}}><label>Search saved records<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={160}/></label><button className="wf-button">Search</button></form>
 <h2>{label(kind)}</h2>{records.loading?<Loading/>:records.error?<Notice error>{records.error}<button onClick={records.reload}>Retry records</button></Notice>:<><p>{records.data?.total||0} records</p><div className="wf-table-wrap"><table className="wf-table"><thead><tr><th>Name / place</th><th>Details</th><th>Status</th><th>Created</th><th>Record</th></tr></thead><tbody>{records.data?.items.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.detail}{item.size!==undefined&&<p>{(item.size/1048576).toFixed(2)} MB</p>}{item.email_verified!==undefined&&<p>Email {item.email_verified?'verified':'not verified'}</p>}</td><td>{label(item.status)}</td><td>{date(item.created_at)}</td><td><small>{item.id}</small>{item.case_id?<p><Link to={`/incidents/${item.case_id}`}>Open incident</Link></p>:item.waterbody_id?<p><Link to={`/waterbodies/${item.waterbody_id}`}>Open passport</Link></p>:null}</td></tr>)}</tbody></table></div>{!records.data?.items.length&&<p>No matching records.</p>}</>}
 <div className="button-row"><button className="wf-button" disabled={page===1||records.loading} onClick={()=>setPage(old=>old-1)}>Previous</button><span>Page {page}</span><button className="wf-button" disabled={!records.data||page*records.data.page_size>=records.data.total||records.loading} onClick={()=>setPage(old=>old+1)}>Next</button><button className="wf-button" onClick={()=>{summary.reload();records.reload();}}>Refresh records</button></div></section></div>;
}

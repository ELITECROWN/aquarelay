import { useState } from 'react';
import { api } from '../api';
import { date, errorText, Notice, useRecord } from './workflowShared';
type Photo={id:string;url?:string;name?:string;mime_type?:string};
type Pair={before_id:string;after_id:string;before_captured_at:string;after_captured_at:string;description:string;recorded_at:string};
export default function ResolutionStory({id,photos,canManage}:{id:string;photos:Photo[];canManage:boolean}) {
 const record=useRecord<{comparison:Pair|null;evidence?:Photo[]}>(`/api/v1/cases/${id}/comparison`);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const images=photos.filter(p=>p.mime_type?.startsWith('image/'));
 return <section className="wf-panel"><h2>Before / follow-up story</h2>{record.error&&<Notice error>{record.error}</Notice>}
 {record.data?.comparison?<><p>{record.data.comparison.description}</p><div className="wf-comparison">{record.data.evidence?.map((p,i)=><figure key={p.id}><img src={p.url} alt={(i?'Follow-up':'Before')+' photograph'}/><figcaption><strong>{i?'Follow-up':'Before'}</strong><small>Reported capture time: {date(i?record.data!.comparison!.after_captured_at:record.data!.comparison!.before_captured_at)}</small><small>Evidence: {p.id}</small></figcaption></figure>)}</div><p>Recorded {date(record.data.comparison.recorded_at)}. Visible changes do not establish water safety or ecological recovery.</p></>:<p>No dated comparison is recorded.</p>}
 {canManage&&images.length>=2&&<form onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError('');try{await api(`/api/v1/cases/${id}/comparison`,{method:'PUT',body:JSON.stringify({before_id:data.get('before_id'),after_id:data.get('after_id'),before_captured_at:new Date(String(data.get('before_time'))).toISOString(),after_captured_at:new Date(String(data.get('after_time'))).toISOString(),description:data.get('description')})});record.reload();}catch(e){setError(errorText(e));}finally{setBusy(false);}}}>
 <div className="wf-form-grid">{['before','after'].map(k=><div key={k}><label className="wf-field">{k==='before'?'Before':'Follow-up'} photograph<select name={k+'_id'} required><option value="">Choose public photograph</option>{images.map(p=><option value={p.id} key={p.id}>{p.name||p.id}</option>)}</select></label><label className="wf-field">Capture date and time (local timezone)<input type="datetime-local" name={k+'_time'} required/></label></div>)}</div>
 <label className="wf-field">Document the action and viewpoint comparison<textarea name="description" minLength={8} maxLength={4000} required/></label><button className="wf-button" disabled={busy}>{busy?'Saving…':'Save dated story'}</button></form>}{error&&<Notice error>{error}</Notice>}
 </section>;
}

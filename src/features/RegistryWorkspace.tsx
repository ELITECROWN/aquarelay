import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../session';
import { errorText, Gate, Notice, useRecord, WorkflowHeader } from './workflowShared';

type Field = { name: string; title: string; type?: string; optional?: boolean; choices?: string[]; value?: string };
function EntryForm({title,endpoint,fields,transform}:{title:string;endpoint:string;fields:Field[];transform?:(body:Record<string,unknown>)=>Record<string,unknown>}) {
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget;setError('');setMessage('');setBusy(true);
    const body:Record<string,unknown>={};const data=new FormData(form);
    fields.forEach(field=>{const raw=String(data.get(field.name)||'');if(raw)body[field.name]=field.type==='number'?Number(raw):field.type==='datetime-local'?new Date(raw).toISOString():raw;});
    try {const result=await api<{id?:string}>(endpoint,{method:'POST',body:JSON.stringify(transform?transform(body):body)});setMessage('Saved'+(result.id?' · '+result.id:''));form.reset();}
    catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  return <section className="wf-panel"><h2>{title}</h2><form onSubmit={submit}><div className="wf-form-grid">{fields.map(f=><label className="wf-field" key={f.name}>{f.title}{f.choices?<select name={f.name} required={!f.optional} defaultValue={f.value||''}><option value="">Choose</option>{f.choices.map(v=><option key={v}>{v}</option>)}</select>:<input name={f.name} type={f.type||'text'} step={f.type==='number'?'any':undefined} required={!f.optional} defaultValue={f.value}/>}</label>)}</div><button className="wf-button" disabled={busy}>{busy?'Saving…':'Save record'}</button></form>{error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}</section>;
}
export default function RegistryWorkspace(){
  const {user}=useSession();const waters=useRecord<{items:{id:string;name:string}[]}>('/api/v1/waterbodies?page_size=100');
  if(!user)return <Gate/>;
  const admin=user.role==='admin',contributor=!!user.organisation_id;
  return <main className="wf-page"><WorkflowHeader eyebrow="Professional contributions" title="Registry & field records" description="Bengaluru launch registry. Preserve provenance and only publish records you are authorised to share."/>
    <p><Link to="/workspace">Case workspace</Link> · <Link to="/integrations">Dataset integrations</Link></p>
    <section className="wf-panel"><h2>Registered identities</h2>{waters.error&&<Notice error>{waters.error}</Notice>}{waters.data?.items.map(w=><p key={w.id}><Link to={'/waterbodies/'+w.id}>{w.name}</Link> <small>{w.id}</small></p>)}</section>
    {admin&&<><EntryForm title="Register a water body" endpoint="/api/v1/admin/waterbodies" fields={[{name:'name',title:'Official or documented name'},{name:'type',title:'Water-body type',choices:['lake','pond','canal','stream','wetland']},{name:'locality',title:'Locality',value:'Bengaluru'},{name:'latitude',title:'Latitude',type:'number'},{name:'longitude',title:'Longitude',type:'number'},{name:'source_name',title:'Registry source / dataset'},{name:'source_url',title:'Source URL',type:'url',optional:true},{name:'license',title:'Permission or licence to publish'},{name:'summary',title:'Identity notes',optional:true},{name:'responsible_organisation_id',title:'Responsible organisation ID',optional:true}]}/>
    <EntryForm title="Add an organisation" endpoint="/api/v1/admin/organisations" fields={[{name:'name',title:'Organisation name'},{name:'description',title:'Role and provenance (minimum 8 characters)'},{name:'contact',title:'Public organisational contact',optional:true}]}/>
    <EntryForm title="Assign registered member" endpoint="/api/v1/admin/memberships" fields={[{name:'email',title:'Registered account email',type:'email'},{name:'organisation_id',title:'Organisation ID'},{name:'role',title:'Role',choices:['manager','researcher','volunteer','citizen']}]}/></>}
    {contributor&&<EntryForm title="Add biodiversity observation" endpoint="/api/v1/biodiversity" fields={[{name:'waterbody_id',title:'Water-body ID'},{name:'common_name',title:'Observed organism'},{name:'scientific_name',title:'Scientific name',optional:true},{name:'observed_at',title:'Observed at (your local timezone)',type:'datetime-local'},{name:'source_name',title:'Field survey / source'},{name:'license',title:'Publishing licence',value:'CC-BY-4.0'},{name:'note',title:'Observation notes',optional:true}]}/>}
    {!admin&&!contributor&&<Notice>An administrator must verify and assign your organisation before you can contribute professional records.</Notice>}
  </main>;
}

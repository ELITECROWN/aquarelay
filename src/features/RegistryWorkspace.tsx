import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import { api } from '../api';
import { useSession } from '../session';
import { errorText, Gate, Notice, useRecord, WorkflowHeader } from './workflowShared';

type Field = { name: string; title: string; type?: string; optional?: boolean; choices?: string[]; value?: string };
function EntryForm({title,endpoint,fields,transform,method='POST'}:{title:string;endpoint:string|((body:Record<string,unknown>)=>string);fields:Field[];transform?:(body:Record<string,unknown>)=>Record<string,unknown>;method?:'POST'|'PUT'}) {
  const cache=useQueryClient();
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget;setError('');setMessage('');setBusy(true);
    const body:Record<string,unknown>={};const data=new FormData(form);
    fields.forEach(field=>{const raw=String(data.get(field.name)||'');if(raw)body[field.name]=field.type==='checkbox'?raw==='on':field.type==='number'?Number(raw):field.type==='datetime-local'?new Date(raw).toISOString():raw;});
    try {const result=await api<{id?:string;assigned_cases?:number}>(typeof endpoint==='function'?endpoint(body):endpoint,{method,body:JSON.stringify(transform?transform(body):body)});setMessage('Saved'+(result.id?' · '+result.id:'')+(result.assigned_cases!==undefined?' · '+result.assigned_cases+' existing cases assigned for review':''));form.reset();await cache.invalidateQueries();}
    catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  return <section className="wf-panel"><h2>{title}</h2><form onSubmit={submit}><div className="wf-form-grid">{fields.map(f=><label className="wf-field" key={f.name}>{f.title}{f.choices?<select name={f.name} required={!f.optional} defaultValue={f.value||''}><option value="">Choose</option>{f.choices.map(v=><option key={v}>{v}</option>)}</select>:<input name={f.name} type={f.type||'text'} step={f.type==='number'?'any':undefined} required={!f.optional} defaultValue={f.value}/>}</label>)}</div><button className="wf-button" disabled={busy}>{busy?'Saving…':'Save record'}</button></form>{error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}</section>;
}
export default function RegistryWorkspace(){
  const {user}=useSession();const [search,setSearch]=useState('');
  const admin=user?.role==='admin',contributor=!!user?.organisation_id;
  const waters=useRecord<{items:{id:string;name:string}[]}>('/api/v1/waterbodies?page_size=100&q='+encodeURIComponent(search));
  const organisations=useRecord<{items:{id:string;name:string}[]}>('/api/v1/organisations',admin);
  const unassigned=useRecord<{items:{id:string;title:string;waterbody_name:string}[]}>('/api/v1/admin/unassigned-cases',admin);
  if(!user)return <Gate/>;
  return <main className="wf-page"><WorkflowHeader eyebrow="Professional contributions" title="Registry & field records" description="Bengaluru, Sodepur–Barrackpore and Potheri starter registry. Preserve provenance and only publish records you are authorised to share."/>
    <p><Link to="/workspace">Case workspace</Link> · <Link to="/integrations">Dataset integrations</Link></p>
    <section className="wf-panel"><h2>Registered identities</h2><label className="wf-field">Find a water body<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Name or locality"/></label>{waters.error&&<Notice error>{waters.error}</Notice>}{waters.data?.items.map(w=><p key={w.id}><Link to={'/waterbodies/'+w.id}>{w.name}</Link> <small>{w.id}</small></p>)}</section>
    {admin&&<section className="wf-panel"><h2>Organisation directory</h2>{organisations.error&&<Notice error>{organisations.error}</Notice>}{organisations.data?.items.map(org=><p key={org.id}>{org.name} <small>{org.id}</small></p>)}<h2>Cases awaiting assignment</h2>{unassigned.error&&<Notice error>{unassigned.error}</Notice>}{unassigned.data?.items.map(record=><p key={record.id}><Link to={'/incidents/'+record.id}>{record.title} · {record.waterbody_name}</Link> <small>{record.id}</small></p>)}{unassigned.data&&!unassigned.data.items.length&&<p>No unassigned open cases.</p>}</section>}
    {admin&&<><EntryForm title="Register a water body" endpoint="/api/v1/admin/waterbodies" fields={[{name:'name',title:'Official or documented name'},{name:'type',title:'Water-body type',choices:['lake','pond','canal','stream','wetland']},{name:'locality',title:'Locality',value:'Bengaluru'},{name:'latitude',title:'Latitude',type:'number'},{name:'longitude',title:'Longitude',type:'number'},{name:'source_name',title:'Registry source / dataset'},{name:'source_url',title:'Source URL',type:'url',optional:true},{name:'license',title:'Permission or licence to publish'},{name:'summary',title:'Identity notes',optional:true},{name:'responsible_organisation_id',title:'Responsible organisation ID',optional:true}]}/>
    <EntryForm title="Add an organisation" endpoint="/api/v1/admin/organisations" fields={[{name:'name',title:'Organisation name'},{name:'description',title:'Role and provenance (minimum 8 characters)'},{name:'contact',title:'Public organisational contact',optional:true}]}/>
    <EntryForm title="Review an organisation social account" endpoint="/api/v1/admin/social-accounts" fields={[{name:'organisation_id',title:'Organisation ID'},{name:'platform',title:'Platform',choices:['x','instagram']},{name:'handle',title:'Profile handle (without @)'},{name:'account_url',title:'Matching HTTPS profile URL',type:'url'},{name:'verification_source',title:'Independent public source confirming ownership',type:'url'},{name:'review_confirmed',title:'I checked the source and verified this profile belongs to the organisation',type:'checkbox'}]}/>
    <EntryForm title="Revoke a social account approval" endpoint="/api/v1/admin/social-accounts/revoke" fields={[{name:'organisation_id',title:'Organisation ID'},{name:'account_id',title:'Approved account ID'}]}/>
    <EntryForm title="Assign registered member" endpoint="/api/v1/admin/memberships" fields={[{name:'email',title:'Registered account email',type:'email'},{name:'organisation_id',title:'Organisation ID'},{name:'role',title:'Role',choices:['manager','researcher','volunteer','citizen']}]}/></>}
    {admin&&<><EntryForm title="Set water-body case coordination" method="PUT" endpoint={body=>'/api/v1/admin/waterbodies/'+encodeURIComponent(String(body.waterbody_id))+'/responsibility'} fields={[{name:'waterbody_id',title:'Water-body ID'},{name:'organisation_id',title:'Organisation ID'},{name:'reason',title:'Documented coordination role (minimum 8 characters)'},{name:'source_name',title:'Assignment source'},{name:'source_url',title:'Public source URL',type:'url',optional:true},{name:'license',title:'Publishing permission or licence'},{name:'assign_existing',title:'Also assign existing unassigned open cases for review',type:'checkbox',optional:true}]}/><EntryForm title="Assign an individual open case" endpoint="/api/v1/admin/case-assignments" fields={[{name:'case_id',title:'Case ID'},{name:'organisation_id',title:'Organisation ID'},{name:'reason',title:'Reason for assignment (minimum 8 characters)'}]}/></>}
    {contributor&&<EntryForm title="Add biodiversity observation" endpoint="/api/v1/biodiversity" fields={[{name:'waterbody_id',title:'Water-body ID'},{name:'common_name',title:'Observed organism'},{name:'scientific_name',title:'Scientific name',optional:true},{name:'observed_at',title:'Observed at (your local timezone)',type:'datetime-local'},{name:'source_name',title:'Field survey / source'},{name:'license',title:'Publishing licence',value:'CC-BY-4.0'},{name:'note',title:'Observation notes',optional:true}]}/>}
    {!admin&&!contributor&&<Notice>An administrator must verify and assign your organisation before you can contribute professional records.</Notice>}
  </main>;
}

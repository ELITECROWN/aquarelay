import { useState } from 'react';
import { Link,useLocation,useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../session';
import { errorText,Notice,WorkflowHeader,useRecord } from './workflowShared';
export default function AccountRecovery(){
 const [params]=useSearchParams(),location=useLocation(),{refresh}=useSession();
 const token=params.get('token')||'',verify=location.pathname.endsWith('/verify');
 const config=useRecord<{capabilities:{email:string}}>('/api/v1/config');
 const unavailable=!token&&config.data?.capabilities.email==='unavailable';
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <main className="wf-page wf-narrow"><WorkflowHeader eyebrow="Account access" title={verify?'Verify email':token?'Choose a new password':'Recover your account'}/><section className="wf-panel"><form onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError('');try{
 const result=await api<{message:string}>('/api/v1/auth/'+(verify?'verify-email':token?'reset-password':'recovery'),{method:'POST',body:JSON.stringify(verify?{token}:token?{token,password:form.get('password')}:{email:form.get('email')})});setMessage(result.message);await refresh();
 }catch(e){setError(errorText(e));}finally{setBusy(false);}}}>
 {!verify&&(token?<label className="wf-field">New password<input type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>:<label className="wf-field">Account email<input type="email" name="email" autoComplete="email" required/></label>)}
 <button className="wf-button" disabled={busy||!!message||verify&&!token||unavailable||config.loading||!!config.error}>{busy?'Processing…':verify?'Verify my email':token?'Update password':'Send recovery email'}</button></form>{unavailable&&<Notice>Email delivery is unavailable. Password recovery and email verification are not enabled for this launch.</Notice>}{config.error&&<Notice error>{config.error}</Notice>}{error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}<p><Link to="/login">Return to sign in</Link></p></section></main>;
}

import { useState } from 'react';
import { api } from '../api';
import { errorText,Notice,useRecord } from './workflowShared';
export default function PushSettings(){
 const config=useRecord<{configured:boolean;public_key:string}>('/api/v1/push/config');
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <div><p>Browser push: {config.data?.configured?'configured':'unavailable'}. Permission is requested only when you enable it.</p><button type="button" className="button secondary" disabled={busy||!config.data?.configured} onClick={async()=>{setBusy(true);setError('');try{
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw new Error('Web Push is not supported in this browser.');
 const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
 const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notification permission was not granted.');
 const value=config.data!.public_key;const raw=atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4));const key=Uint8Array.from(raw,c=>c.charCodeAt(0));
 const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 await api('/api/v1/push/subscriptions',{method:'POST',body:JSON.stringify(subscription.toJSON())});setMessage('Browser notifications enabled for recorded updates.');
 }catch(e){setError(errorText(e));}finally{setBusy(false);}}}>Enable browser notifications</button><button type="button" className="text-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api('/api/v1/push/subscriptions',{method:'DELETE'});const registration=await navigator.serviceWorker.getRegistration('/sw.js');await (await registration?.pushManager.getSubscription())?.unsubscribe();setMessage('Push notifications disabled for this account.');}catch(e){setError(errorText(e));}finally{setBusy(false);}}}>Disable push on all browsers</button>{message&&<Notice>{message}</Notice>}{error&&<Notice error>{error}</Notice>}</div>;
}

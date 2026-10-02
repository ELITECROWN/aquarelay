let csrf = '';
export function setCsrf(value:string){csrf=value;}
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
  const method=(options.method||'GET').toUpperCase();
  const headers=new Headers(options.headers);
  if(options.body && !(options.body instanceof FormData))headers.set('Content-Type','application/json');
  if(!['GET','HEAD','OPTIONS'].includes(method))headers.set('X-CSRF-Token',csrf);
  const response=await fetch(path.startsWith('/api')?path:`/api/v1${path}`,{...options,headers,credentials:'include'});
  if(!response.ok){let message=`Request failed (${response.status})`;try{const data=await response.json();message=typeof data.detail==='string'?data.detail:JSON.stringify(data.detail||data);}catch{}throw new Error(message);}
  if(response.status===204)return undefined as T;
  const type=response.headers.get('content-type')||'';
  return (type.includes('json')?await response.json():await response.text()) as T;
}

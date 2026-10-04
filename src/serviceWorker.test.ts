import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect,vi} from 'vitest';

function worker(cached?: Response) {
  const listeners: Record<string,(event:any)=>void> = {};
  const cache = {match:vi.fn().mockResolvedValue(cached),put:vi.fn().mockResolvedValue(undefined)};
  const fetcher = vi.fn().mockResolvedValue(new Response('export default 1', {headers:{'content-type':'application/javascript'}}));
  runInNewContext(readFileSync('public/sw.js','utf8'), {
    self:{location:{origin:'https://aquarelay.example'},addEventListener:(name:string,handler:any)=>{listeners[name]=handler;}},
    caches:{open:async()=>cache}, fetch:fetcher, URL, Response,
  });
  return {listeners,cache,fetcher};
}

describe('offline asset integrity',()=>{
  it('does not serve cached HTML as a map script',async()=>{
    const {listeners,cache,fetcher}=worker(new Response('<html>old rewrite</html>',{headers:{'content-type':'text/html'}}));
    let result:Promise<Response>;
    listeners.fetch({request:{url:'https://aquarelay.example/assets/map.js',method:'GET'},respondWith:(value:Promise<Response>)=>{result=value;}});
    expect((await result!).headers.get('content-type')).toBe('application/javascript');
    expect(fetcher).toHaveBeenCalledOnce();expect(cache.put).toHaveBeenCalledOnce();
  });
  it('does not cache a new HTML rewrite returned for a deleted script',async()=>{
    const {listeners,cache,fetcher}=worker();
    fetcher.mockResolvedValue(new Response('<html>rewrite</html>',{headers:{'content-type':'text/html'}}));
    let result:Promise<Response>;
    listeners.fetch({request:{url:'https://aquarelay.example/assets/map.js',method:'GET'},respondWith:(value:Promise<Response>)=>{result=value;}});
    await result!;expect(cache.put).not.toHaveBeenCalled();
  });
});

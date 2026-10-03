export interface SocialAccount {
  id:string;
  handle:string;
  platform:'x'|'instagram';
  account_url:string;
  organisation_name:string;
  verification_source:string;
  verified_at:string;
}

export function selectedSocialHandles(accounts:Pick<SocialAccount,'id'|'handle'>[],selected:string[]) {
  const seen=new Set<string>();
  return accounts.filter(a=>selected.includes(a.id)&&/^[A-Za-z0-9_.]{1,30}$/.test(a.handle))
    .filter(a=>{const key=a.handle.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;})
    .slice(0,5).map(a=>'@'+a.handle);
}

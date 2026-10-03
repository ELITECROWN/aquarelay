import {describe,it,expect} from 'vitest';
import {selectedSocialHandles} from './socialAccounts';

describe('optional social handles',()=>{
  const accounts=[{id:'one',handle:'ReviewedTeam'},{id:'two',handle:'OtherTeam'}];
  it('never appends accounts without user selection',()=>expect(selectedSocialHandles(accounts,[])).toEqual([]));
  it('uses only selected accounts still present in the approved response',()=>expect(selectedSocialHandles(accounts,['one','revoked'])).toEqual(['@ReviewedTeam']));
  it('deduplicates handles and limits voluntary mentions',()=>expect(selectedSocialHandles(Array.from({length:12},(_,i)=>({id:String(i),handle:'Team'+i})),Array.from({length:12},(_,i)=>String(i)))).toHaveLength(5));
});

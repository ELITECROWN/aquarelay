import {describe,it,expect} from 'vitest';
import {workflowLabel} from './labels';
describe('factual workflow labels',()=>{it('keeps absence of cases separate from environmental condition',()=>expect(workflowLabel('open',0)).toBe('No open cases — condition not assessed'));it('marks unreviewed community reports',()=>expect(workflowLabel('submitted')).toBe('Community report — not yet reviewed'));it('does not equate closure to restoration',()=>expect(workflowLabel('closed')).toBe('Closed'));});

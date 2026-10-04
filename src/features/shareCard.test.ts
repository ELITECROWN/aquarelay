import {describe,it,expect} from 'vitest';
import {textLines,cardSize} from './shareCard';
describe('share-card text and platform sizing',()=>{
 it('uses portrait story/status dimensions and square feed dimensions',()=>{expect(cardSize('instagram')).toEqual({width:1080,height:1920});expect(cardSize('whatsapp')).toEqual({width:1080,height:1920});expect(cardSize('square')).toEqual({width:1080,height:1080});});
 it('keeps an unbroken name or URL within its width',()=>{const lines=textLines('abcdefghijklmnopqrst',s=>s.length,8,3);expect(lines.length).toBeLessThanOrEqual(3);expect(lines.every(s=>s.length<=8)).toBe(true);});
 it('marks truncated records instead of silently losing words',()=>{const lines=textLines('one two three four five six seven',s=>s.length,9,2);expect(lines).toHaveLength(2);expect(lines[1].endsWith('…')).toBe(true);});
 it('preserves short text',()=>{expect(textLines('Lake update',s=>s.length,20,3)).toEqual(['Lake update']);});
});

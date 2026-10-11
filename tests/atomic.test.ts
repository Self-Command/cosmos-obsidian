import {it,expect,vi,afterEach} from 'vitest';
vi.mock('node:fs/promises',()=>({rename:vi.fn()}));
import {rename} from 'node:fs/promises';
import {replaceFile} from '../src/state/atomic.js';
afterEach(()=>{vi.resetAllMocks();});
it('retries a transient state replacement asynchronously without browser blocking primitives',async()=>{
  const blocked=vi.spyOn(Atomics,'wait').mockImplementation(()=>{throw Error('Renderer blocks synchronous waits');});
  vi.mocked(rename).mockRejectedValueOnce(Object.assign(Error('busy'),{code:'EPERM'})).mockResolvedValueOnce(undefined);
  try{await replaceFile('temporary','receipt');expect(rename).toHaveBeenCalledTimes(2);expect(blocked).not.toHaveBeenCalled();}finally{blocked.mockRestore();}
});
it('stops on permanent errors and bounds persistent transient failures',async()=>{
  vi.mocked(rename).mockRejectedValue(Object.assign(Error('missing'),{code:'ENOENT'}));await expect(replaceFile('temporary','receipt')).rejects.toThrow('missing');expect(rename).toHaveBeenCalledTimes(1);
  vi.mocked(rename).mockClear().mockRejectedValue(Object.assign(Error('busy'),{code:'EBUSY'}));await expect(replaceFile('temporary','receipt')).rejects.toThrow('busy');expect(rename).toHaveBeenCalledTimes(13);
});

import fs from 'node:fs';
import {rename} from 'node:fs/promises';
const transient=(error:unknown)=>['EPERM','EBUSY','EACCES'].includes((error as NodeJS.ErrnoException).code??'');
// Windows readers and scanners can briefly hold a handle that denies replacement.
// Retry only the durable rename; never repeat the mutation that produced the result.
export async function replaceFile(temporary:string,target:string) {
  for(let attempt=0;;attempt++){
    try{await rename(temporary,target);return;}
    catch(error){if(attempt>=12||!transient(error))throw error;await new Promise(resolve=>setTimeout(resolve,25));}
  }
}
export function replaceFileSync(temporary:string,target:string) {
  for(let attempt=0;;attempt++){
    try{fs.renameSync(temporary,target);return;}
    catch(error){if(attempt>=12||!transient(error))throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);}
  }
}

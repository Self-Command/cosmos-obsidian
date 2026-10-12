import {readFile} from 'node:fs/promises';
const release=new URL('../../../',import.meta.url);
if(!process.env.COSMOS_CONFIG&&!process.argv.includes('--config')){
  try{const connection=JSON.parse(await readFile(new URL('connection.json',release),'utf8'));if(typeof connection.configPath==='string')process.env.COSMOS_CONFIG=connection.configPath;}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
await import(new URL('cosmos.mjs',release));

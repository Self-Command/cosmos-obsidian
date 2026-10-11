import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {Installer} from './manager.js';
import {CosmosError,failure} from '../errors.js';
const args=process.argv.slice(2),command=args.shift();
const option=(flag:string)=>{const at=args.indexOf(flag);if(at<0)return undefined;const value=args[at+1];if(!value||value.startsWith('--'))throw new CosmosError('INVALID_INPUT',flag+' 需要值。');args.splice(at,2);return value;};
async function main(){
  const packageRoot=option('--package')??path.dirname(fileURLToPath(import.meta.url)),root=option('--root'),config=option('--config'),id=option('--installation'),destinationsFile=option('--destinations'),confirm=args.includes('--confirm');if(confirm)args.splice(args.indexOf('--confirm'),1);
  if(args.length)throw new CosmosError('INVALID_INPUT','安装选项未登记。');
  if(!command||command==='help')return {ok:true,commands:['stage --root ROOT --config BINDING','plan --root ROOT --destinations JSON_FILE','switch --root ROOT --installation ID --confirm','status --root ROOT --installation ID','recover --root ROOT --installation ID --confirm']};
  if(!root)throw new CosmosError('INVALID_INPUT','需要独立 --root 安装目录。');const installer=new Installer(packageRoot);
  if(command==='stage'&&config)return installer.stage(root,config);
  if(command==='plan'&&destinationsFile){const destinations=JSON.parse((await readFile(destinationsFile,'utf8')).replace(/^\uFEFF/,''));if(!Array.isArray(destinations)||destinations.some(x=>typeof x!=='string'))throw new CosmosError('INVALID_INPUT','发现目录需要绝对路径列表。');return installer.plan(root,destinations);}
  if(command==='switch'&&id)return installer.switch(root,id,confirm);
  if(command==='status'&&id)return installer.status(root,id);
  if(command==='recover'&&id)return installer.recover(root,id,confirm);
  throw new CosmosError('INVALID_INPUT','安装命令或必要选项缺失。');
}
main().then(result=>{process.stdout.write(JSON.stringify(result)+'\n');if(!result.ok)process.exitCode=4;}).catch(error=>{const {exitCode,...result}=failure(error);process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=exitCode;});

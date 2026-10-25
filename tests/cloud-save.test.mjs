import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const snapshotUrl = moduleUrl(await compile('../lib/storage/snapshot.ts'));
const mergeUrl = moduleUrl(await compile('../lib/storage/merge.ts'));
let serial=0;
async function harness(server, drafts=new Map()) {
  const key=`__cloudTest${++serial}`, hooks={ states:[], effects:[], drafts };
  globalThis[key]=hooks;
  const react=moduleUrl(`const h=globalThis.${key}; export function useRef(current){return {current}}; export function useState(initial){const i=h.states.length;h.states.push(initial);return [initial,v=>{h.states[i]=v}];}; export function useEffect(fn){h.effects.push(fn)};`);
  const draftUrl=moduleUrl(`export async function groupDraft(id,op,value){const d=globalThis.${key}.drafts;if(op==='put')d.set(id,structuredClone(value));if(op==='delete')d.delete(id);return structuredClone(d.get(id))}`);
  const source=(await compile('../lib/storage/use-cloud-data.ts')).replace('"react"',JSON.stringify(react)).replace('"./snapshot"',JSON.stringify(snapshotUrl)).replace('"./merge"',JSON.stringify(mergeUrl)).replace('"./drafts"',JSON.stringify(draftUrl));
  const {useCloudData}=await import(moduleUrl(source));
  globalThis.fetch=server;
  globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
  const initial={milestones:[],goals:[],questions:[],characters:[],settings:{journeySubtitle:'test'}};
  const snapshot=data=>({version:2,data:structuredClone(data),images:{}});
  const api=useCloudData({groupId:'711',initial,empty:async()=>structuredClone(initial),snapshot:async data=>snapshot(data),prepare:async s=>s,restore:async s=>structuredClone(s.data),authorize:async()=>true});
  const cleanup=hooks.effects[0]();
  for(let i=0;i<100&&!hooks.states[1];i++)await new Promise(r=>setTimeout(r,1));
  assert.equal(hooks.states[1],true,'loaded');
  return {api,hooks,initial,snapshot,cleanup};
}
const character=id=>({id,name:id,fallback:'Q',passion:'code',power:'team',item:'book',vibe:'happy'});
function serverState(){
 let current,tag=0,fail=false,loseAck=false;
 return {get current(){return current},set fail(v){fail=v},set loseAck(v){loseAck=v},fetch:async(_url,init={})=>{
   if(init.method==='PUT'){
     if(fail)throw Error('offline');
     const expected=init.headers['If-Match'];
     if((current&&expected!==`"${tag}"`)||(!current&&expected))return Response.json({error:'conflict'},{status:409});
     current=JSON.parse(init.body);tag++;
     if(loseAck){loseAck=false;throw Error('response lost')}
     return new Response(null,{status:204,headers:{'X-QueenB-Version':`"${tag}"`}});
   }
   return Response.json(current||{empty:true},{headers:current?{'X-QueenB-Version':`"${tag}"`}:{}});
 }}}

test('failed save keeps a recoverable draft and reports failure; reload and retry preserves avatar',async()=>{
 const server=serverState(),drafts=new Map(); const first=await harness(server.fetch,drafts);
 server.fail=true;
 assert.equal(await first.api.update({...first.initial,characters:[character('a')]}),false);
 assert.equal(drafts.get('711').local.data.characters.length,1);
 first.cleanup();server.fail=false;
 const restored=await harness(server.fetch,drafts);
 assert.equal(restored.hooks.states[0].characters[0].id,'a');
 assert.equal(await restored.api.retry(),true);
 assert.equal(server.current.data.characters.length,1);assert.equal(drafts.size,0);
 restored.cleanup();
});

test('two loaded clients merge simultaneous additions and acknowledge both saves',async()=>{
 const server=serverState();const a=await harness(server.fetch),b=await harness(server.fetch);
 const result=await Promise.all([a.api.update({...a.initial,characters:[character('a')]}),b.api.update({...b.initial,characters:[character('b')]})]);
 assert.deepEqual(result,[true,true]);assert.deepEqual(server.current.data.characters.map(c=>c.id).sort(),['a','b']);
 a.cleanup();b.cleanup();
});

test('lost server acknowledgement followed by recovery does not duplicate an avatar',async()=>{
 const server=serverState(),drafts=new Map();const a=await harness(server.fetch,drafts);server.loseAck=true;
 assert.equal(await a.api.update({...a.initial,characters:[character('a')]}),false);a.cleanup();
 const b=await harness(server.fetch,drafts);assert.equal(await b.api.retry(),true);
 assert.equal(server.current.data.characters.length,1);b.cleanup();
});

test('changes arriving during an upload are included before the save promise resolves',async()=>{
 const server=serverState();let release,started;const entered=new Promise(r=>started=r);let held=true;
 const slow=async(url,init)=>{if(init?.method==='PUT'&&held){held=false;started();await new Promise(r=>release=r)}return server.fetch(url,init)};
 const a=await harness(slow);const p=a.api.update({...a.initial,characters:[character('a')]});await entered;
 const p2=a.api.update({...a.initial,characters:[character('a'),character('b')]});release();
 assert.equal(await p,true);assert.equal(await p2,true);assert.equal(server.current.data.characters.length,2);a.cleanup();
});

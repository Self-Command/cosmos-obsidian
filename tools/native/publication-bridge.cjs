/* TEST ONLY. Appended after the exact owned bridge to the official Enveloppe 7.8.2 bundle. */
{
  const fixtureRepository='cosmos-obsidian-publication-fixture';
  const ownedReload=Enveloppe.prototype.reloadOctokit;
  Enveloppe.prototype.loadToken=async function(){return process.env.PUBLICATION_TOKEN||'';};
  Enveloppe.prototype.reloadOctokit=async function(...args){
    const client=await ownedReload.apply(this,args),owned=client.__amytisOwnedRequest;
    client.__amytisOwnedRequest=async(route,params)=>{
      if(params.owner!=='Self-Command'||params.repo!=='amytis')throw Error('Test mapping rejects a different target.');
      const mapped={...params,repo:fixtureRepository};
      // One genuine remote upload fails before PR creation. The branch and persisted batch remain.
      if(this.app.__cosmosFixtureFailPR&&route==='POST /repos/{owner}/{repo}/pulls'){
        delete this.app.__cosmosFixtureFailPR;throw Error('Synthetic connection failure before PR creation');
      }
      return owned(route,mapped);
    };
    return client;
  };
  const originalFetch=globalThis.fetch;
  globalThis.fetch=function(input,options){
    const url=typeof input==='string'?input:input?.url;
    if(url?.startsWith('https://self-command.github.io/amytis/')){
      return originalFetch('https://self-command.github.io/'+fixtureRepository+url.slice('https://self-command.github.io'.length),options);
    }
    return originalFetch(input,options);
  };
}

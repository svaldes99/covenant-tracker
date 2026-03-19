import{INITIAL_ISSUERS}from"../../lib/data";
let memoryStore=null;
async function getKV(){
  if(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN){
    return{
      get:async(key)=>{const r=await fetch(`${process.env.KV_REST_API_URL}/get/${key}`,{headers:{Authorization:`Bearer ${process.env.KV_REST_API_TOKEN}`}});const d=await r.json();return d.result?JSON.parse(d.result):null;},
      set:async(key,value)=>{await fetch(`${process.env.KV_REST_API_URL}/set/${key}`,{method:"POST",headers:{Authorization:`Bearer ${process.env.KV_REST_API_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify(JSON.stringify(value))});}
    };
  }
  return{get:async()=>memoryStore,set:async(_,v)=>{memoryStore=v;}};
}
export default async function handler(req,res){
  const kv=await getKV();
  if(req.method==="GET"){const data=await kv.get("issuers");return res.status(200).json(data||INITIAL_ISSUERS);}
  if(req.method==="POST"){
    const{issuerId,covenants,fechaEEFF}=req.body;
    let data=await kv.get("issuers")||INITIAL_ISSUERS;
    data=data.map(iss=>{
      if(iss.id!==issuerId)return iss;
      const updatedCovenants=iss.covenants.map(cov=>{
        const extracted=covenants.find(e=>e.name===cov.name);
        if(!extracted||extracted.actual===null)return cov;
        return{...cov,actual:extracted.actualStr,act:extracted.actual,holgura:extracted.holguraStr};
      });
      return{...iss,covenants:updatedCovenants,fechaEEFF:fechaEEFF||iss.fechaEEFF};
    });
    await kv.set("issuers",data);
    return res.status(200).json({ok:true});
  }
  if(req.method==="PUT"){await kv.set("issuers",req.body);return res.status(200).json({ok:true});}
  res.status(405).end();
}
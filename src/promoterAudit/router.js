const express=require('express');
const ApiResponse=require('../utils/responses');
function createRouter(getDb){
 const router=express.Router();
 async function release(){const db=getDb();if(!db)throw Error('Unavailable');const state=(await db.doc('promoterAuditState/current').get()).data();if(!state)return null;const ref=db.collection('promoterAuditReleases').doc(state.releaseId);const meta=(await ref.get()).data();if(meta?.status!=='READY')throw Error('Unavailable');return{ref,meta};}
 router.get('/promoter-quality/top-10',async(req,res)=>{res.set('Cache-Control','no-store');try{const r=await release();if(!r)return ApiResponse.success(res,null);const entries=await Promise.all(r.meta.top10.map(async t=>({... (await r.ref.collection('audits').doc(t.companyCode).get()).data(),rank:t.rank})));return ApiResponse.success(res,{entries,auditAsOfDate:r.meta.auditAsOfDate,auditVersion:r.meta.auditVersion});}catch{return ApiResponse.error(res,'Promoter research is temporarily unavailable',503);}});
 router.get('/:companyCode/promoter-audit',async(req,res)=>{res.set('Cache-Control','no-store');if(!/^[0-9]+$/.test(req.params.companyCode)||/^0+$/.test(req.params.companyCode))return ApiResponse.error(res,'Invalid company code',400);try{const r=await release();if(!r)return ApiResponse.success(res,null);const audit=(await r.ref.collection('audits').doc(req.params.companyCode).get()).data();if(!audit)return ApiResponse.success(res,null);const sources=await r.ref.collection('sources').where('companyCode','==',req.params.companyCode).get();return ApiResponse.success(res,{...audit,sources:sources.docs.map(d=>d.data()).sort((a,b)=>a.sourceNumber-b.sourceNumber),methodology:r.meta.methodology});}catch{return ApiResponse.error(res,'Promoter research is temporarily unavailable',503);}});
 return router;
}
module.exports={createRouter};

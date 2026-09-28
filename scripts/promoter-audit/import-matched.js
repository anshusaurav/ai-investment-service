// Firebase-only immutable import. Reads the validated read_workbook.py output.
const fs=require('fs'),crypto=require('crypto');
const {parseArgs}=require('node:util');
const {values:args}=parseArgs({options:{input:{type:'string'},'env-file':{type:'string'},publish:{type:'boolean'},report:{type:'string',default:'reports/matched-import.json'}}});
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const groups=(a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n));
async function main(){
 if(!args.input)throw Error('--input required');
 const w=JSON.parse(fs.readFileSync(args.input,'utf8'));
 require('dotenv').config({path:args['env-file']||'.env'});
 const admin=require('firebase-admin');
 let account;
 if(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
 else account={projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')};
 const app=admin.initializeApp({projectId:process.env.FIREBASE_PROJECT_ID,credential:admin.credential.cert(account)});
 const db=app.firestore();
 try{
 const matches=new Map(),ambiguous=new Set();
 const batches=groups(w.audits.map(a=>a.companyCode),30);
 for(const parallel of groups(batches,4)){
  const results=await Promise.all(parallel.map(codes=>db.collection('documents').where('companyCode','in',codes).select('companyCode').get()));
  for(const result of results)for(const d of result.docs){const c=d.data().companyCode;if(matches.has(c))ambiguous.add(c);matches.set(c,d.id);}
 }
 if(ambiguous.size)throw Error('Ambiguous company codes: '+[...ambiguous].join(','));
 const audits=w.audits.filter(a=>matches.has(a.companyCode));const sources=w.sources.filter(s=>matches.has(s.companyCode));
 const unmatched=w.audits.filter(a=>!matches.has(a.companyCode)).map(a=>({companyCode:a.companyCode,companyName:a.companyName}));
 const state=db.doc('promoterAuditState/current');const old=(await state.get()).data()?.releaseId||null;
 const fingerprint=hash(JSON.stringify({w,associations:[...matches].sort()}));
 const releases=db.collection('promoterAuditReleases');
 const summary={workbookRowsRead:w.workbookRowsRead,matchedCompanies:audits.length,unmatchedCompanies:unmatched.length,auditsInserted:0,sourcesInserted:0,plannedAudits:audits.length,plannedSources:sources.length,published:false,auditVersion:w.auditVersion,auditAsOfDate:w.auditAsOfDate,collection:'promoterAuditReleases',unmatched};
 function report(){fs.mkdirSync(require('path').dirname(args.report),{recursive:true});fs.writeFileSync(args.report,JSON.stringify(summary,null,2));}
 report();console.log(JSON.stringify({matched:audits.length,unmatched:unmatched.length,sources:sources.length,mode:args.publish?'publish':'dry-run'}));
 if(!args.publish)return;
 if(!audits.length)throw Error('No matching companies');
 if(old&&(await releases.doc(old).get()).data()?.fingerprint===fingerprint){summary.published=true;summary.unchanged=true;summary.releaseId=old;report();console.log('Identical release already active: '+old);return;}
 const ref=releases.doc();const now=new Date().toISOString();
 await ref.create({status:'STAGING',fingerprint,workbookHash:w.workbookHash,auditVersion:w.auditVersion,auditAsOfDate:w.auditAsOfDate,auditCount:audits.length,sourceCount:sources.length,skippedCount:unmatched.length,top10:w.top10.filter(t=>matches.has(t.companyCode)),methodology:w.methodology,createdAt:now});
 try{
  const writes=audits.map(a=>{const doc=ref.collection('audits').doc(a.companyCode);return{ref:doc,data:{...a,id:doc.path,companyId:matches.get(a.companyCode),createdAt:now,updatedAt:now}};});
  writes.push(...sources.map(s=>{const doc=ref.collection('sources').doc(hash(s.companyCode+'\n'+s.url));return{ref:doc,data:{...s,id:doc.id,promoterAuditId:ref.collection('audits').doc(s.companyCode).path,createdAt:now}};}));
  let done=0;
  for(const chunk of groups(writes,400)){const batch=db.batch();chunk.forEach(x=>batch.create(x.ref,x.data));await batch.commit();done+=chunk.length;if(done%2000===0)console.log('Staged '+done+' of '+writes.length+' records');}
  // Verify every stored field and relationship before atomic publication.
  const [storedAudits,storedSources]=await Promise.all([ref.collection('audits').get(),ref.collection('sources').get()]);
  if(storedAudits.size!==audits.length||storedSources.size!==sources.length)throw Error('Stored counts differ');
  const expected=new Map(writes.map(x=>[x.ref.path,x.data]));
  const {isDeepStrictEqual}=require('node:util');
  for(const doc of [...storedAudits.docs,...storedSources.docs])if(!isDeepStrictEqual(doc.data(),expected.get(doc.ref.path)))throw Error('Verification failed for '+doc.ref.path);
  await db.runTransaction(async tx=>{const current=(await tx.get(state)).data()?.releaseId||null;if(current!==old)throw Error('Active release changed concurrently');tx.update(ref,{status:'READY',publishedAt:now,verifiedAt:new Date().toISOString()});tx.set(state,{releaseId:ref.id,previousReleaseId:old,updatedAt:now});});
  summary.published=true;summary.releaseId=ref.id;summary.auditsInserted=audits.length;summary.sourcesInserted=sources.length;summary.verified=true;report();console.log(JSON.stringify({published:true,releaseId:ref.id,audits:audits.length,sources:sources.length,skipped:unmatched.length,verified:true}));
 }catch(e){const status=(await ref.get()).data()?.status;if(status!=='READY')await db.recursiveDelete(ref);throw e;}
 }finally{await db.terminate();await app.delete();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

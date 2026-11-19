import {readFile} from 'node:fs/promises';
const endpoint='https://the-browser-one.vercel.app/api/telegram/copy/run';
async function main(){
 const key=process.env.CRONJOB_API_KEY??process.env.CRONJOB_API__KEY;
 const file=process.env.PREMIUM_ACCESS_CRON_SECRET_FILE;
 if(!key||!file)throw new Error('Configuration de maintenance requise.');
 const secret=(await readFile(file,'utf8')).trim();
 async function api(path,method='GET',body){
  const r=await fetch('https://api.cron-job.org'+path,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw new Error('Ordonnanceur indisponible.');return r.json();
 }
 const list=await api('/jobs');
 if(list.someFailed||!Array.isArray(list.jobs))throw new Error('Liste incomplète.');
 const matches=list.jobs.filter(j=>j.url===endpoint);
 if(matches.length>1)throw new Error('Plusieurs tâches identiques.');
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({dryRun:true,existing:matches.length}));return;}
 const probe=await fetch(endpoint,{headers:{Authorization:`Bearer ${secret}`},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!probe.ok)throw new Error('Worker non disponible.');
 const job={title:'The Browser — copies Telegram Premium',url:endpoint,enabled:true,requestMethod:1,requestTimeout:180,saveResponses:true,redirectSuccess:false,
  extendedData:{headers:{Authorization:`Bearer ${secret}`},body:''},
  schedule:{timezone:'UTC',expiresAt:0,hours:[-1],mdays:[-1],minutes:[-1],months:[-1],wdays:[-1]}};
 const jobId=matches[0]?.jobId;
 const id=jobId?(await api(`/jobs/${jobId}`,'PATCH',{job}),jobId):(await api('/jobs','PUT',{job})).jobId;
 if(!Number.isSafeInteger(id))throw new Error('Identifiant de tâche absent.');
 const {jobDetails:saved}=await api(`/jobs/${id}`);
 if(saved.url!==endpoint||!saved.enabled||saved.requestMethod!==1||saved.extendedData?.headers?.Authorization!==`Bearer ${secret}`||JSON.stringify(saved.schedule.minutes)!=='[-1]')throw new Error('Configuration non confirmée.');
 console.log(JSON.stringify({jobId:id,enabled:true,intervalMinutes:1,endpoint}));
}
main().catch(()=>{console.error('Configuration interrompue ; vérifier le worker et les accès sans afficher les secrets.');process.exitCode=1;});

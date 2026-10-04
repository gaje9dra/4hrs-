import { db } from "@/lib/db/client";
import { runGovernanceMaintenance } from "@/lib/delivery-intelligence/service";

const jobKey="delivery-intelligence-maintenance";
const bucket=Math.floor(Date.now()/60000);
const idempotencyKey=jobKey+":"+bucket;
const existing=await db.deliveryGovernanceJobRun.findUnique({where:{idempotencyKey}});
if(existing?.status==="COMPLETED"){console.log(JSON.stringify({status:"IDEMPOTENT_REPLAY",jobId:existing.id}));process.exit(0);}
const run=await db.deliveryGovernanceJobRun.create({data:{jobKey,idempotencyKey,status:"RUNNING"}});
try{
 const result=await runGovernanceMaintenance("SYSTEM");
 await db.deliveryGovernanceJobRun.update({where:{id:run.id},data:{status:"COMPLETED",...result,completedAt:new Date()}});
 console.log(JSON.stringify({status:"COMPLETED",...result}));
}catch(error){
 await db.deliveryGovernanceJobRun.update({where:{id:run.id},data:{status:"FAILED",error:error instanceof Error?error.message:"Unknown maintenance failure",completedAt:new Date()}});
 console.error(error);process.exit(1);
}

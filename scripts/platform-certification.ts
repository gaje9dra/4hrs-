import { collectPlatformCertification } from "../lib/platform-certification/service";

async function main(){
  const record=await collectPlatformCertification({persist:process.env.CERTIFICATION_PERSIST==="true"});
  console.log(JSON.stringify(record,null,2));
  if(process.env.CERTIFICATION_STRICT==="true" && (record.readiness==="NOT_READY"||record.readiness==="BLOCKED")) process.exitCode=2;
}
void main();

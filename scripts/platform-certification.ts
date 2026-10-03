import { collectPlatformCertification } from "../lib/platform-certification/service";
const record=await collectPlatformCertification({persist:process.env.CERTIFICATION_PERSIST==="true"});
console.log(JSON.stringify(record,null,2));
if(record.readiness==="NOT_READY"||record.readiness==="BLOCKED") process.exitCode=2;

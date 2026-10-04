import { SAFE_STRATEGIES } from "../lib/reliability/autonomous-model";
const required=Object.values(SAFE_STRATEGIES);
if(!required.length) throw new Error("No reliability strategies registered.");
for(const strategy of required){
 if(strategy.maxSteps<1||strategy.maxSteps>10) throw new Error("Strategy step bound is invalid.");
 if(strategy.maxMutations<0||strategy.maxMutations>10) throw new Error("Strategy mutation bound is invalid.");
 if(strategy.maxChainDurationSeconds<1||strategy.maxChainDurationSeconds>3600) throw new Error("Strategy duration bound is invalid.");
 if(!strategy.preconditions.length||!strategy.postconditions.length) throw new Error("Strategy must declare pre/postconditions.");
}
console.log(JSON.stringify({strategies:required.map(x=>x.stableId),safe:true}));

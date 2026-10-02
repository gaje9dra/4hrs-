export type CaseObservation={operation:string;result:string;caseReference?:string;correlationId?:string;};
export function logCaseObservation(event:CaseObservation){if(process.env.NODE_ENV!=="test")console.info("[case]",JSON.stringify(event));}

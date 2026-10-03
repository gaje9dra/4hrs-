export const LOCKED_STACK = {
  node: "24.21.0", npm: "11.x", next: "16.3.5", react: "19.3.0", reactDom: "19.3.0",
  typescript: "6.0.3", eslint: "9.39.5", tailwind: "4.3.3", prisma: "6.19.3",
} as const;
export type BlockerLevel="BLOCKER"|"HIGH"|"MEDIUM"|"LOW"|"INFORMATIONAL";
export type ReadinessState="READY_FOR_PRODUCTION"|"READY_WITH_DOCUMENTED_LIMITATIONS"|"NOT_READY"|"BLOCKED";
export type CertificationFinding={id:string;level:BlockerLevel;title:string;impact:string;evidence:string;owner?:string};
export function readinessFor(findings:CertificationFinding[]):ReadinessState {
  if(findings.some(f=>f.level==="BLOCKER")) return "NOT_READY";
  if(findings.some(f=>f.level==="HIGH"||f.level==="MEDIUM")) return "READY_WITH_DOCUMENTED_LIMITATIONS";
  return "READY_FOR_PRODUCTION";
}

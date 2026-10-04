INSERT INTO "AutomationPolicy"
("id","stableId","name","description","domain","trigger","conditions","actions","risk","authorization","requiredPermissions","allowedEnvironments","enabled","dryRun","cooldownSeconds","maxExecutionsPerWindow","timeoutSeconds","retryLimit","concurrencyPolicy","idempotencyPolicy","rollbackPolicy","escalationPolicy","observabilityRequirements","auditRequirements","owner","reviewer","version","status")
VALUES
(gen_random_uuid(),'phase-15-26-synthetic-diagnostic','Synthetic diagnostic rerun','Rerun a registered synthetic workflow only after deterministic safety evaluation.','synthetic',
'{"kind":"synthetic_failure","requiresCorroboration":true}',
'[{"key":"syntheticFailure","operator":"EQ","value":true}]',
'["RERUN_SYNTHETIC_CHECK"]','SAFE_AUTOMATION',
'{"requiresPermission":"automation.execute","humanApproval":false}',
'["automation.evaluate","automation.execute"]','{"PRODUCTION"}',false,true,300,1,300,0,
'{"mode":"single-target","maxConcurrent":1}',
'{"key":"triggerFingerprint+policyVersion+target"}',
'{"mode":"IRREVERSIBLE","automatic":false}',
'{"onFailure":"OPEN_CIRCUIT_AND_ESCALATE"}',
'{"structuredEvents":true,"metrics":true}',
'{"immutableExecutionEvidence":true}',
'platform-operations','sre-operations',1,'APPROVED'),
(gen_random_uuid(),'phase-15-26-observe-only','Operational condition observer','Evaluate operational conditions without mutating production state.','operations',
'{"kind":"health_degradation","requiresCorroboration":true}',
'[{"key":"healthDegraded","operator":"EQ","value":true}]',
'["RECORD_DIAGNOSTIC"]','OBSERVE_ONLY',
'{"requiresPermission":"automation.evaluate","humanApproval":false}',
'["automation.evaluate"]','{"PRODUCTION"}',false,true,60,10,60,0,
'{"mode":"single-target","maxConcurrent":1}',
'{"key":"triggerFingerprint+policyVersion+target"}',
'{"mode":"IRREVERSIBLE","automatic":false}',
'{"onFailure":"ESCALATE"}',
'{"structuredEvents":true}',
'{"immutableExecutionEvidence":true}',
'platform-operations','sre-operations',1,'APPROVED');

INSERT INTO "AutomationPolicyVersion" ("id","policyId","version","snapshot")
SELECT gen_random_uuid(),p.id,p.version,jsonb_build_object('stableId',p."stableId",'risk',p.risk,'trigger',p.trigger,'conditions',p.conditions,'actions',p.actions,'enabled',p.enabled,'dryRun',p."dryRun")
FROM "AutomationPolicy" p
WHERE p."stableId" IN ('phase-15-26-synthetic-diagnostic','phase-15-26-observe-only');

INSERT INTO "AutomationCircuit" ("id","policyId","state")
SELECT gen_random_uuid(),p.id,'CLOSED' FROM "AutomationPolicy" p
WHERE p."stableId" IN ('phase-15-26-synthetic-diagnostic','phase-15-26-observe-only')
ON CONFLICT ("policyId") DO NOTHING;

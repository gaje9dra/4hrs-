import test from "node:test";
import assert from "node:assert/strict";
import {
  DEPLOYMENT_ENVIRONMENTS,
  DEPLOYMENT_STATUSES,
  RECOVERY_CLASSES,
  INCIDENT_DECISIONS,
  REGISTERED_OPERATIONS,
} from "../lib/deployment-control/service";

test("deployment environments are bounded", () => {
  assert.deepEqual([...DEPLOYMENT_ENVIRONMENTS], ["development","test","staging","production"]);
});
test("deployment lifecycle includes verified recovery states", () => {
  assert.ok(DEPLOYMENT_STATUSES.includes("VERIFIED"));
  assert.ok(DEPLOYMENT_STATUSES.includes("ROLLBACK_PENDING"));
  assert.ok(DEPLOYMENT_STATUSES.includes("ROLLED_BACK"));
  assert.ok(DEPLOYMENT_STATUSES.includes("FORWARD_RECOVERY_REQUIRED"));
});
test("recovery and incident vocabularies are explicit", () => {
  assert.equal(RECOVERY_CLASSES.length, 4);
  assert.deepEqual([...INCIDENT_DECISIONS], ["ALLOW","ALLOW_WITH_APPROVAL","DELAY","BLOCK"]);
});
test("deployment operations are registered and do not expose arbitrary execution", () => {
  assert.ok(REGISTERED_OPERATIONS.includes("DEPLOY_ARTIFACT"));
  assert.ok(!REGISTERED_OPERATIONS.includes("SHELL" as never));
  assert.ok(!REGISTERED_OPERATIONS.includes("SQL" as never));
});

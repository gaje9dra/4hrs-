import assert from "node:assert/strict";
import test from "node:test";
import { DEPENDENCY_GRAPH,OPERATIONAL_HEALTH_STATES,RUNBOOKS,SERVICE_INVENTORY,combineHealth,propagateDependencyHealth } from "../lib/operations/model";
test("phase 15.25 inventory and runbooks are complete",()=>{assert.ok(SERVICE_INVENTORY.length>=15);assert.ok(DEPENDENCY_GRAPH.length>=15);assert.ok(RUNBOOKS.length>=15);assert.deepEqual(OPERATIONAL_HEALTH_STATES,["HEALTHY","DEGRADED","FAILING","BLOCKED","MAINTENANCE","UNKNOWN","UNAVAILABLE"]);});
test("unknown never becomes healthy through propagation",()=>{assert.equal(propagateDependencyHealth("storefront",DEPENDENCY_GRAPH),"UNKNOWN");assert.equal(combineHealth(["HEALTHY","UNKNOWN"]),"UNKNOWN");});
test("critical failure propagates",()=>{assert.equal(combineHealth(["HEALTHY","FAILING"]),"FAILING");assert.equal(combineHealth(["HEALTHY","UNAVAILABLE"]),"UNAVAILABLE");});
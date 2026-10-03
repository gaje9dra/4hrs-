import assert from "node:assert/strict";
import test from "node:test";
import { LOCKED_STACK, readinessFor } from "../lib/platform-certification/model";
test("locked stack is explicit",()=>{assert.equal(LOCKED_STACK.node,"24.21.0");assert.equal(LOCKED_STACK.next,"16.3.5");assert.equal(LOCKED_STACK.typescript,"6.0.3");});
test("blockers force NOT_READY",()=>{assert.equal(readinessFor([{id:"x",level:"BLOCKER",title:"x",impact:"x",evidence:"x"}]),"NOT_READY");});
test("high findings without blockers remain documented limitations",()=>{assert.equal(readinessFor([{id:"x",level:"HIGH",title:"x",impact:"x",evidence:"x"}]),"READY_WITH_DOCUMENTED_LIMITATIONS");});
test("no findings can certify",()=>{assert.equal(readinessFor([]),"READY_FOR_PRODUCTION");});

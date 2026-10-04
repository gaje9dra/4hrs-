import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPH_CONFIDENCE,GRAPH_NODE_TYPES,GRAPH_PROVENANCE,GRAPH_RELATION_TYPES,freshnessFrom } from "@/lib/platform-graph/model";
import { normalizePageSize,normalizeTraversalDepth,validateGraphConfidence,validateGraphNodeType,validateGraphProvenance,validateGraphRelationType } from "@/lib/platform-graph/service";
test("closed graph vocabularies reject arbitrary values",()=>{assert.equal(GRAPH_NODE_TYPES.length,33);assert.equal(GRAPH_RELATION_TYPES.length,28);assert.doesNotThrow(()=>validateGraphNodeType("SERVICE"));assert.throws(()=>validateGraphNodeType("MAGIC"));assert.doesNotThrow(()=>validateGraphRelationType("DEPENDS_ON"));assert.throws(()=>validateGraphRelationType("ARBITRARY"));});
test("provenance and confidence are explicit",()=>{assert.equal(GRAPH_PROVENANCE.length,13);assert.equal(GRAPH_CONFIDENCE.length,5);assert.doesNotThrow(()=>validateGraphProvenance("CODE"));assert.throws(()=>validateGraphProvenance("GUESS"));assert.doesNotThrow(()=>validateGraphConfidence("VERIFIED"));});
test("freshness is never silently certain",()=>{assert.equal(freshnessFrom(null,null,60),"UNKNOWN");assert.equal(freshnessFrom(new Date(),null,60),"CURRENT");});
test("traversal and pagination are bounded",()=>{assert.equal(normalizeTraversalDepth(99),5);assert.equal(normalizeTraversalDepth(-1),2);assert.equal(normalizePageSize(999),50);});

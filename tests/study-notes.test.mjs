import assert from "node:assert/strict";
import test from "node:test";
import { chunkSources,generateStudyNotes,NOTES_SCHEMA,transcriptSources,validateNotes } from "../services/notes/generate.mjs";

const empty=()=>Object.fromEntries(Object.keys(NOTES_SCHEMA.properties).map(key=>[key,[]]));
test("source lines retain their wording and timestamps",()=>{
  const sources=transcriptSources("[00:00] Photosynthesis uses light.\n[01:10] Reflection is due at the end of week 3.");
  assert.deepEqual(sources,[{id:"L1",timestamp:"00:00",text:"Photosynthesis uses light."},{id:"L2",timestamp:"01:10",text:"Reflection is due at the end of week 3."}]);
});
test("long input is chunked without losing source text",()=>{
  const sources=transcriptSources("A".repeat(25000));
  assert.equal(sources.map(source=>source.text).join(""),"A".repeat(25000));
  const chunks=chunkSources(sources);
  assert.ok(chunks.length>1);
  assert.deepEqual([...new Set(chunks.flat().map(source=>source.id))],sources.map(source=>source.id));
  assert.ok(chunks.every(chunk=>chunk.reduce((total,source)=>total+source.text.length+30,0)<=6500));
});
test("unknown citations and fabricated quotes are rejected",()=>{
  const sources=transcriptSources("[00:00] Submit the reflection at the end of week 3.");
  const draft=empty();
  draft.assignments=[
    {text:"Submit the reflection at the end of week 3.",source_ids:["L1"],quote:"at the end of week 3"},
    {text:"The exam is tomorrow.",source_ids:["L99"],quote:"exam is tomorrow"},
    {text:"The exam is tomorrow.",source_ids:["L1"],quote:"exam is tomorrow"},
  ];
  const result=validateNotes(draft,sources);
  assert.equal(result.sections.assignments.length,1);
  assert.equal(result.sections.assignments[0].sources[0].timestamp,"00:00");
  assert.equal(result.rejected,2);
});
test("note generation preserves the input and returns only evidence-backed entries",async()=>{
  const transcript="[00:00] Submit the reflection at the end of week 3.";
  let prompt;
  const result=await generateStudyNotes(transcript,{complete:async messages=>{
    prompt=messages;
    return {...empty(),assignments:[{text:"The reflection is due at the end of week 3.",source_ids:["L1"],quote:"at the end of week 3"}]};
  }});
  assert.equal(transcript,"[00:00] Submit the reflection at the end of week 3.");
  assert.equal(result.model,"Qwen3-4B-Instruct-2507");
  assert.equal(result.sections.assignments.length,1);
  assert.match(prompt[0].content,/untrusted source data/);
  assert.match(prompt[0].content,/never invent a calendar date/);
  assert.deepEqual(result.warnings,[]);
});
test("evidence can span adjacent segments but not disconnected or reversed passages",()=>{
  const sources=transcriptSources("[00:00] Use the same table format.\n[00:10] Submit at the end of week 3.\n[00:20] Include relevant collaborations only.");
  const draft=empty();
  draft.assignments=[
    {text:"Use the table format and submit at the end of week 3.",source_ids:["L1","L2"],quote:"Use the same table format. Submit at the end of week 3."},
    {text:"Stitched evidence",source_ids:["L1","L3"],quote:"Use the same table format. Include relevant collaborations only."},
    {text:"Reversed evidence",source_ids:["L2","L1"],quote:"Submit at the end of week 3. Use the same table format."},
  ];
  const verified=validateNotes(draft,sources);
  assert.equal(verified.sections.assignments.length,1);
  assert.equal(verified.rejected,2);
  assert.deepEqual(verified.sections.assignments[0].sources,[{id:"L1",timestamp:"00:00"},{id:"L2",timestamp:"00:10"}]);
});
test("invalid model output fails instead of saving an empty fake summary",async()=>{
  await assert.rejects(()=>generateStudyNotes("[00:00] A real statement.",{complete:async()=>"not JSON"}),/invalid JSON/);
  await assert.rejects(()=>generateStudyNotes("[00:00] A real statement.",{complete:async()=>({overview:"wrong type"})}),/invalid notes structure/);
});

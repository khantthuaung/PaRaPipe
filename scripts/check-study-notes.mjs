import assert from "node:assert/strict";

const base="http://localhost:3000";
const id=`notes-qa-${crypto.randomUUID()}`;
const title="Temporary Qwen 4B QA lecture";
const transcript=[
  "[00:00] Photosynthesis converts light energy into chemical energy.",
  "[00:12] Chlorophyll is the green pigment that absorbs light in chloroplasts.",
  "[00:25] Use the same table format for each weekly reflection.",
  "[00:40] The weekly reflection is due at the end of week 3.",
  "[00:52] Mention a collaborator only if the collaboration is relevant to that week's work. Do not include unrelated collaborations.",
  "[01:05] Can we add next month's planned activities? No, describe only work from the week being reflected on.",
].join("\n");
const typedNotes="My own notes — preserve this text exactly.\n\nDo not replace this with AI output.";
async function json(path,init){
  const response=await fetch(base+path,{...init,signal:AbortSignal.timeout(30000)});
  let data;try{data=await response.json()}catch{throw new Error(`Non-JSON response (${response.status})`)}
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data;
}
let created=false;
try{
  let health;
  for(let attempt=0;attempt<40;attempt++){health=await json("/api/notes");if(health.ready)break;await new Promise(resolve=>setTimeout(resolve,1000))}
  assert.equal(health.ready,true,health.error);
  await json("/api/lectures",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,title,subject:"Notes QA",transcript,summary:typedNotes,createdAt:new Date().toISOString(),duration:80})});
  created=true;
  const started=performance.now();
  const submitted=await json(`/api/lectures/${id}/notes`,{method:"POST"});
  console.log(JSON.stringify({notesJob:submitted.status}));
  let result;
  for(let attempt=0;attempt<200;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1500));
    result=await json(`/api/lectures/${id}/notes`);
    if(result.status==="failed")throw new Error(result.error);
    if(result.status==="complete")break;
  }
  assert.equal(result.status,"complete","Notes did not complete");
  assert.equal(result.notes.model,"Qwen3-4B-Instruct-2507");
  console.log(JSON.stringify(result.notes,null,2));
  const entries=Object.values(result.notes.sections).flat();
  assert.ok(entries.length>0,"No grounded notes were generated");
  assert.ok(result.notes.sections.assignments.some(entry=>/week 3/i.test(entry.text)),"The explicit deadline was missed");
  assert.ok(result.notes.sections.assignments.some(entry=>/table|format/i.test(entry.text)),"The required reflection format was missed");
  assert.ok(result.notes.sections.assignments.some(entry=>/collaborat/i.test(entry.text)&&/only|relevan/i.test(entry.text)),"The collaboration relevance condition was missed");
  const normalized=transcript.replace(/\s+/g," ");
  assert.ok(entries.every(entry=>entry.sources.length&&normalized.includes(entry.quote)),"An evidence quote is not present in the source");
  const lecture=(await json("/api/lectures")).find(item=>item.id===id);
  assert.equal(lecture.transcript,transcript);
  assert.equal(lecture.summary,typedNotes);
  const saved=await json(`/api/lectures/${id}/notes`);
  assert.deepEqual(saved.notes,result.notes);
  console.log(JSON.stringify({endToEnd:"passed",supportedEntries:entries.length,deadlineFound:true,rawTranscriptUnchanged:true,typedNotesUnchanged:true,separatelySaved:true,seconds:Math.round((performance.now()-started)/1000)}));
  if(process.argv.includes("--inspect")){
    console.log(`Temporary lecture ready for browser inspection: ${id}. Press Return to remove only this test data.`);
    process.stdin.resume();
    await new Promise(resolve=>process.stdin.once("data",resolve));
    process.stdin.pause();
  }
}finally{
  if(created){const lecture=(await json("/api/lectures")).find(item=>item.id===id);if(lecture?.title===title){await json(`/api/lectures?id=${id}`,{method:"DELETE"});console.log("Removed only the temporary notes QA lecture, generated draft, and local job.")}}
}

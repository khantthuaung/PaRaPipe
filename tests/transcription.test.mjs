import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { startServer, transcriptFromResult } from "../services/transcription/server.mjs";

test("raw segments retain their text and timestamps without summaries", () => {
  assert.equal(transcriptFromResult({transcription:[
    {text:" First point. ",offsets:{from:0}},
    {text:"Second point.",offsets:{from:65000}},
    {text:"Final point.",offsets:{from:3605000}},
  ]}),"[00:00] First point.\n[01:05] Second point.\n[01:00:05] Final point.");
  assert.throws(()=>transcriptFromResult({error:"not a transcript"}));
});

test("local jobs require authentication, run once, persist and can be deleted", async t => {
  const directory=await mkdtemp(join(tmpdir(),"notedly-transcription-test-"));
  let calls=0;
  let runtime=await startServer({port:0,directory,token:"test-only-token",runner:async()=>{calls++;return "[00:00] Public test speech."}});
  let base=`http://127.0.0.1:${runtime.server.address().port}`;
  const headers={authorization:"Bearer test-only-token","content-type":"audio/wav"};
  t.after(async()=>{await runtime.close();await rm(directory,{recursive:true,force:true})});
  const unauthorized=await fetch(`${base}/jobs/test-recording`);
  assert.equal(unauthorized.status,401);
  const crossOrigin=await fetch(`${base}/health`,{headers:{origin:"https://example.com"}});
  assert.equal(crossOrigin.status,403);
  const started=await fetch(`${base}/jobs/test-recording`,{method:"POST",headers,body:"test bytes"});
  assert.equal(started.status,202);
  let result;
  for(let count=0;count<100;count++){
    result=await fetch(`${base}/jobs/test-recording`,{headers}).then(response=>response.json());
    if(result.status==="complete")break;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(result.status,"complete");
  assert.equal(result.transcript,"[00:00] Public test speech.");
  await fetch(`${base}/jobs/test-recording`,{method:"POST",headers,body:"same recording"});
  assert.equal(calls,1);
  await runtime.close();
  runtime=await startServer({port:0,directory,token:"test-only-token",runner:async()=>{throw new Error("Completed jobs must not rerun")}});
  base=`http://127.0.0.1:${runtime.server.address().port}`;
  const restored=await fetch(`${base}/jobs/test-recording`,{headers}).then(response=>response.json());
  assert.equal(restored.transcript,result.transcript);
  const deleted=await fetch(`${base}/jobs/test-recording`,{method:"DELETE",headers});
  assert.equal(deleted.status,200);
  assert.equal((await fetch(`${base}/jobs/test-recording`,{headers})).status,404);
});

test("failed local jobs can retry without changing recording identity", async t => {
  const directory=await mkdtemp(join(tmpdir(),"notedly-transcription-retry-"));
  let calls=0;
  const runtime=await startServer({port:0,directory,token:"test-only-token",runner:async()=>{if(++calls===1)throw new Error("Test interruption");return "Retry worked."}});
  t.after(async()=>{await runtime.close();await rm(directory,{recursive:true,force:true})});
  const base=`http://127.0.0.1:${runtime.server.address().port}`;
  const headers={authorization:"Bearer test-only-token","content-type":"audio/wav"};
  async function waitFor(status){for(let count=0;count<100;count++){const job=await fetch(`${base}/jobs/retry-recording`,{headers}).then(response=>response.json());if(job.status===status)return job;await new Promise(resolve=>setTimeout(resolve,10))}throw new Error("Job did not finish")}
  await fetch(`${base}/jobs/retry-recording`,{method:"POST",headers,body:"test bytes"});
  await waitFor("failed");
  await fetch(`${base}/jobs/retry-recording`,{method:"POST",headers,body:"same test bytes"});
  assert.equal((await waitFor("complete")).transcript,"Retry worked.");
  assert.equal(calls,2);
});

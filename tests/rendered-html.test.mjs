import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import {readFileSync,existsSync} from "node:fs";
import {dirname,resolve} from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);

test("local storage works without OpenAI hosting metadata or packaging",async()=>{
  const config=await readFile(new URL("../vite.config.ts",import.meta.url),"utf8");
  assert.doesNotMatch(config,/\.openai|sites-vite-plugin|hostingConfig|sites\(\)/);
  assert.match(config,/binding: "DB"/);
  assert.match(config,/binding: "RECORDINGS"/);
  assert.match(config,/database_name: "site-creator-d1"/);
  assert.match(config,/bucket_name: "site-creator-r2"/);
  for(const path of [".openai/hosting.json","build/sites-vite-plugin.ts"]){
    await assert.rejects(access(new URL(`../${path}`,import.meta.url)),{code:"ENOENT"});
  }
  const ignore=await readFile(new URL("../.gitignore",import.meta.url),"utf8");
  assert.ok(ignore.split("\n").includes("/.openai/"));
});

test("PaRaPipe uses the supplied logo and the warm light palette without resetting saved data",async()=>{
  const {exports:{NotedlyApp}}=await loadSource("app/page.tsx");
  const html=renderToStaticMarkup(React.createElement(NotedlyApp));
  assert.match(html,/PaRaPipe/);
  assert.match(html,/src="\/parapipe-logo.png"/);
  assert.doesNotMatch(html,/src="\/figma\/24dc9.png"|>Notedly</);
  await access(new URL("../public/parapipe-logo.png",import.meta.url));
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  for(const color of ["#FAF7EF","#FFFFFF","#211C16","#C99724","#795510","#70685C","#E5DDCD"])assert.ok(css.includes(color),`Missing palette color ${color}`);
  assert.match(css,/:root\[data-theme=dark\]\{color-scheme:dark/);
  assert.match(css,/animation:theme-reveal 1\.5s/);
  const theme=await readFile(new URL("../lib/theme.ts",import.meta.url),"utf8");
  assert.match(theme,/notedly-theme/);
  const layout=await readFile(new URL("../app/layout.tsx",import.meta.url),"utf8");
  assert.match(layout,/PaRaPipe — Lecture notes that stick/);
});

test("theme selection respects saved preferences and falls back to the system", async () => {
  const {exports:{resolveTheme,themeInitScript}}=await loadSource("lib/theme.ts");
  for(const [saved,system,expected] of [[null,true,"dark"],[null,false,"light"],["light",true,"light"],["dark",false,"dark"],["invalid",true,"dark"]]){
    assert.equal(resolveTheme(saved,system),expected);
    const root={dataset:{}};
    runInNewContext(themeInitScript,{localStorage:{getItem:()=>saved},window:{matchMedia:()=>({matches:system})},document:{documentElement:root}});
    assert.equal(root.dataset.theme,expected);
  }
  const root={dataset:{}};
  runInNewContext(themeInitScript,{localStorage:{getItem:()=>{throw new Error("blocked")}},window:{matchMedia:()=>({matches:true})},document:{documentElement:root}});
  assert.equal(root.dataset.theme,"dark");
});

test("theme toggle is labeled and uses an accessible pressed state", async()=>{
  const {exports:{ThemeToggle}}=await loadSource("app/components/theme-toggle.tsx");
  const html=renderToStaticMarkup(React.createElement(ThemeToggle));
  assert.match(html,/aria-label="Dark mode"/);
  assert.match(html,/aria-pressed="false"/);
  assert.match(html,/type="button"/);
});

for(const mode of ["native","fallback","reduced","blocked-storage","skipped-transition"]){
  test(`theme toggle switches in place with ${mode}`,async()=>{
    const root={dataset:{theme:"light"},style:{setProperty:()=>{}}};
    const writes=[];let transitions=0;let fallbackTimers=0;
    const doc={documentElement:root};
    if(mode==="native"||mode==="skipped-transition")doc.startViewTransition=update=>{transitions++;update();return {finished:mode==="skipped-transition"?Promise.reject(new Error("skipped")):Promise.resolve()}};
    const fakeReact={useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{}};
    const {exports:{ThemeToggle}}=await loadSource("app/components/theme-toggle.tsx",{react:fakeReact},{document:doc,window:{innerWidth:1280,innerHeight:900,matchMedia:()=>({matches:mode==="reduced"}),setTimeout:callback=>{fallbackTimers++;callback()}},localStorage:{setItem:(key,value)=>{if(mode==="blocked-storage")throw new Error("blocked");writes.push([key,value])}}});
    const button=ThemeToggle();
    const event={currentTarget:{getBoundingClientRect:()=>({left:1200,top:10,width:46,height:28})}};
    await button.props.onClick(event);
    assert.equal(root.dataset.theme,"dark");
    assert.equal(root.dataset.themeTransition,undefined);
    assert.equal(transitions,mode==="native"||mode==="skipped-transition"?1:0);
    assert.equal(fallbackTimers,mode==="fallback"||mode==="blocked-storage"?1:0);
    if(mode!=="blocked-storage")assert.deepEqual(writes.at(-1),["notedly-theme","dark"]);
    await button.props.onClick(event);
    assert.equal(root.dataset.theme,"light");
  });
}

// Load the real TypeScript components and handlers, with in-memory storage
// bindings for API tests. No browser microphone or saved user data is touched.
async function loadSource(path, bindings = {}, globals = {}) {
  const root=new URL("../",import.meta.url).pathname;
  const cache=new Map();
  function load(filename){
  if(cache.has(filename))return cache.get(filename);
  const source = readFileSync(filename,"utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  cache.set(filename,module.exports);
  runInNewContext(compiled.outputText, {
    module, exports: module.exports,
    require: name => {if(Object.hasOwn(bindings,name))return bindings[name];if(!name.startsWith("."))return require(name);const base=resolve(dirname(filename),name);const local=[base,base+".ts",base+".tsx",base+".mjs"].find(file=>existsSync(file));if(!local)throw new Error(`Missing test module ${name}`);return load(local)},
    Request, Response, Headers, URL,URLSearchParams, crypto, TextEncoder, AbortSignal,console,setTimeout,clearTimeout, ...globals,
  }, { filename });
  cache.set(filename,module.exports);return module.exports;
  }
  return { exports:load(resolve(root,path)),source:readFileSync(resolve(root,path),"utf8") };
}

for (const [view, heading] of Object.entries({
  home: "Start a lecture recording", lectures: "Lectures library",
  materials: "Materials &amp; resources", subjects: "Your subjects",
})) {
  test(`renders the ${view} page with separate navigation`, async () => {
    const { exports: { NotedlyApp } } = await loadSource("app/page.tsx");
    const html = renderToStaticMarkup(React.createElement(NotedlyApp, { view }));
    assert.ok(html.includes(heading));
    for (const href of ["/", "/lectures", "/materials", "/subjects"]) {
      assert.ok(html.includes(`href="${href}"`));
    }
    assert.doesNotMatch(html, /Retry transcription|CREATING NOTES|Live transcript/);
    if (view === "home") assert.match(html, /Whisper Small creates the raw transcript locally/);
  });
}

test("saving keeps typed notes intact and transcribes before creating study notes", async () => {
  const { source } = await loadSource("app/use-notedly.ts");
  assert.doesNotMatch(source, /SpeechRecognition|beginRecognition|processMaterial|retryLecture|\/process/);
  assert.match(source, /transcript:"",summary:notes/);
  assert.match(source, /cacheLecture\(lecture,audio\)/);
  assert.match(source, /\/api\/recordings\?id=/);
  assert.match(source, /fetch\("\/api\/lectures"/);
  assert.match(await readFile(new URL("../app/components/lecture-workspace.tsx",import.meta.url),"utf8"), /View saved transcript/);
  assert.match(source, /startTranscript\("lectures",id\)/);
  assert.doesNotMatch(source, /makeSummary|beginRecognition/);
  assert.match(source,/startStudyNotes\(kind,id\)/);
});

test("ML routes, service code, and worker bindings are removed", async () => {
  for (const path of ["app/api/lectures/[id]/process/route.ts", "app/api/materials/[id]/process/route.ts", "lib/ml-response.ts", "ml-service/app.py", "docker-compose.ml.yml"]) {
    await assert.rejects(access(new URL(`../${path}`, import.meta.url)), { code: "ENOENT" });
  }
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(worker, /ML_SERVICE/);
});

test("material lists preserve prior notes and show storage-only statuses", async () => {
  const rows = [
    { id: "pdf", kind: "pdf", transcript: null, summary: null },
    { id: "video", kind: "link", transcript: null, summary: null },
    { id: "saved", kind: "audio", transcript: "Original transcript", summary: "Existing notes" },
  ];
  const db = { prepare: () => ({ all: async () => ({ results: rows }) }) };
  const { exports: { GET } } = await loadSource("app/api/materials/route.ts", {
    "cloudflare:workers": { env: {} },
    "../../../lib/materials-db": { materialsDb: async () => db },
  });
  const response = await GET();
  const result = await response.json();
  assert.deepEqual(result.map(item => item.status), ["Uploaded", "Link saved", "Notes saved"]);
  assert.equal(result[2].transcript, rows[2].transcript);
  assert.equal(result[2].summary, rows[2].summary);
});

test("uploaded materials can be downloaded without processing", async () => {
  const db = { prepare: () => ({ bind: () => ({ first: async () => ({ name: "Week 3 notes.pdf", storage_key: "materials/test" }) }) }) };
  const bucket = { get: async () => ({
    body: "stored file bytes", httpEtag: '"test-etag"',
    writeHttpMetadata: headers => headers.set("content-type", "application/pdf"),
  }) };
  const { exports: { GET } } = await loadSource("app/api/materials/[id]/file/route.ts", {
    "cloudflare:workers": { env: { RECORDINGS: bucket } },
    "../../../../../lib/materials-db": { materialsDb: async () => db },
  });
  const response = await GET(new Request("http://localhost/api/materials/test/file"), { params: Promise.resolve({ id: "test" }) });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "stored file bytes");
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition"), /attachment;.*Week%203%20notes\.pdf/);
});

test("missing material files return 404", async () => {
  const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
  const { exports: { GET } } = await loadSource("app/api/materials/[id]/file/route.ts", {
    "cloudflare:workers": { env: {} },
    "../../../../../lib/materials-db": { materialsDb: async () => db },
  });
  const response = await GET(new Request("http://localhost/api/materials/missing/file"), { params: Promise.resolve({ id: "missing" }) });
  assert.equal(response.status, 404);
});

test("recordings are stored directly without any model call", async () => {
  let stored;
  const { exports: { PUT } } = await loadSource("app/api/recordings/route.ts", {
    "cloudflare:workers": { env: { RECORDINGS: {
      put: async (key, body, options) => { stored = { key, bytes: await new Response(body).text(), options }; },
    } } },
  });
  const response = await PUT(new Request("http://localhost/api/recordings?id=test-recording", {
    method: "PUT", headers: { "content-type": "audio/webm" }, body: "test audio", duplex: "half",
  }));
  assert.equal(response.status, 201);
  assert.equal(stored.key, "lectures/test-recording");
  assert.equal(stored.bytes, "test audio");
  assert.equal(stored.options.httpMetadata.contentType, "audio/webm");
});

test("lecture saves preserve typed notes verbatim and attach the recording", async () => {
  let values;
  const db = { prepare: () => ({ bind: (...args) => { values = args; return { run: async () => ({ success: true }) }; } }) };
  const { exports: { POST } } = await loadSource("app/api/lectures/route.ts", {
    "cloudflare:workers": { env: {} },
    "../../../lib/lectures-db": { lecturesDb: async () => db },
    "../../../lib/transcription": { transcriptionRequest: async () => ({ok:true}) },
    "../../../lib/study-notes": { deleteStudyNotes: async () => undefined },
  });
  const notes = "  First point\n\nSecond point — keep this formatting.  ";
  const response = await POST(new Request("http://localhost/api/lectures", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "test-recording", subject: "Course", title: "Lecture", transcript: "", summary: notes, createdAt: "2026-10-13T00:00:00Z", duration: 10, audioKey: "lectures/test-recording" }),
  }));
  assert.equal(response.status, 201);
  assert.equal(values[3], "");
  assert.equal(values[4], notes);
  assert.equal(values[7], "lectures/test-recording");
});

test("completed transcription updates only raw text, never typed notes", async () => {
  const writes=[];
  const db={prepare:sql=>({bind:(...values)=>({first:async()=>({audio_key:"lectures/test-recording",transcript:""}),run:async()=>{writes.push({sql,values})}})})};
  const {exports:{GET}}=await loadSource("app/api/lectures/[id]/transcript/route.ts",{
    "cloudflare:workers":{env:{}},
    "../../../../../lib/lectures-db":{lecturesDb:async()=>db},
    "../../../../../lib/transcription":{transcriptionRequest:async()=>({status:"complete",transcript:"[00:00] Unchanged spoken words."})},
  });
  const response=await GET(new Request("http://localhost/api/lectures/test-recording/transcript"),{params:Promise.resolve({id:"test-recording"})});
  assert.equal(response.status,200);
  assert.equal(writes.length,1);
  assert.equal(writes[0].sql,"UPDATE lectures SET transcript = ? WHERE id = ?");
  assert.deepEqual(Array.from(writes[0].values),["[00:00] Unchanged spoken words.","test-recording"]);
});

test("bookmarked video links are not sent to the speech model", async () => {
  const db={prepare:()=>({bind:()=>({first:async()=>({kind:"link",storage_key:null,transcript:null})})})};
  const {exports:{POST}}=await loadSource("app/api/materials/[id]/transcript/route.ts",{
    "cloudflare:workers":{env:{}},
    "../../../../../lib/materials-db":{materialsDb:async()=>db},
    "../../../../../lib/transcription":{submitRecording:()=>{throw new Error("Must not transcribe a bookmark")}},
  });
  const response=await POST(new Request("http://localhost/api/materials/test-material/transcript",{method:"POST"}),{params:Promise.resolve({id:"test-material"})});
  assert.equal(response.status,422);
});

test("generated drafts use separate R2 storage and never update typed notes or transcripts",async()=>{
  const writes=[];
  const draft={model:"Qwen3-4B-Instruct-2507",createdAt:"2026-10-15T00:00:00Z",sections:{overview:[],concepts:[],definitions:[],examples:[],assignments:[],unclear:[]},warnings:[]};
  const db={prepare:sql=>{assert.match(sql,/^SELECT transcript FROM lectures/);return {bind:()=>({first:async()=>({transcript:"[00:00] Source text."})})}}};
  const bucket={get:async()=>null,put:async(...values)=>{writes.push(values)}};
  const {exports:{handleStudyNotes}}=await loadSource("lib/study-notes.ts",{
    "cloudflare:workers":{env:{RECORDINGS:bucket,NOTES_SERVICE_URL:"http://127.0.0.1:8181",TRANSCRIPTION_SERVICE_TOKEN:"test-only"}},
    "./lectures-db":{lecturesDb:async()=>db},"./materials-db":{},
  },{fetch:async()=>Response.json({status:"complete",notes:draft})});
  const response=await handleStudyNotes("lectures","test-lecture",true);
  assert.equal(response.status,200);
  assert.equal(writes[0][0],"study-notes/lectures/test-lecture.json");
  assert.equal(JSON.parse(writes[0][1]).notes.model,draft.model);
});

test("sources without transcripts cannot generate study notes",async()=>{
  const db={prepare:()=>({bind:()=>({first:async()=>({transcript:""})})})};
  const {exports:{handleStudyNotes}}=await loadSource("lib/study-notes.ts",{
    "cloudflare:workers":{env:{}},"./lectures-db":{lecturesDb:async()=>db},"./materials-db":{},
  });
  const response=await handleStudyNotes("lectures","test-lecture",true);
  assert.equal(response.status,422);
});

test("redesigned library filters and sorts actual records without mutating them",async()=>{
  const {exports:{filterLectures}}=await loadSource("lib/workspace.ts");
  const rows=[{id:"a",title:"Zoology",subject:"Biology",summary:"Personal example",transcript:"Cells use energy",createdAt:"2026-10-01",duration:2},{id:"b",title:"Algorithms",subject:"Computing",summary:"",transcript:"Trees and graphs",createdAt:"2026-10-02",duration:4}];
  assert.deepEqual(Array.from(filterLectures(rows,"graphs")).map(row=>row.id),["b"]);
  assert.deepEqual(Array.from(filterLectures(rows,"","Biology")).map(row=>row.id),["a"]);
  assert.deepEqual(Array.from(filterLectures(rows,"","","title")).map(row=>row.id),["b","a"]);
  assert.deepEqual(Array.from(filterLectures(rows,"","","oldest")).map(row=>row.id),["a","b"]);
  assert.equal(filterLectures(rows,"missing").length,0);
  assert.deepEqual(rows.map(row=>row.id),["a","b"]);
});

test("transcript presentation preserves wording, including untimestamped lines",async()=>{
  const {exports:{transcriptSegments,formatTime}}=await loadSource("lib/workspace.ts");
  const segments=transcriptSegments("[00:12] Original words.\n\n[01:02:03] Keep this phrase.\nUntimestamped sentence.");
  assert.equal(segments[0].timestamp,"00:12");assert.equal(segments[1].timestamp,"01:02:03");assert.equal(segments[2].text,"Untimestamped sentence.");
  assert.equal(formatTime(3723),"1:02:03");assert.equal(formatTime(7),"00:07");
});

test("processing badges distinguish transcription, no speech and separate notes failures",async()=>{
  const {exports:{processingLabel}}=await loadSource("lib/workspace.ts");
  assert.equal(processingLabel("",{status:"running"}).text,"Transcribing");
  assert.equal(processingLabel("",{status:"complete"}).text,"No speech detected");
  assert.equal(processingLabel("Original",{status:"complete"},{status:"failed"}).text,"Study notes need a retry");
  assert.equal(processingLabel("Original",undefined,{status:"complete"}).text,"Study notes ready");
});

test("lecture workspace separates personal text, raw transcript, and grounded AI draft",async()=>{
  const {exports:{LectureWorkspace}}=await loadSource("app/components/lecture-workspace.tsx");
  const lecture={id:"qa-lecture",subject:"Biology",title:"QA lecture",createdAt:"2026-10-15",duration:80,summary:"My words\nUntouched.",transcript:"[00:40] Submit at the end of week 3.",audioKey:"lectures/qa-lecture"};
  const study={status:"complete",notes:{model:"Qwen3-4B-Instruct-2507",sections:{assignments:[{text:"Submit at the end of week 3.",quote:"Submit at the end of week 3.",sources:[{id:"L1",timestamp:"00:40"}]}]},warnings:[]}};
  const html=renderToStaticMarkup(React.createElement(LectureWorkspace,{lecture,study,onTranscribe:()=>{},onGenerate:()=>{}}));
  for(const text of ["Your notes","Raw transcript","AI study notes","My words\nUntouched.","[00:40]","Matching transcript quote","Download audio","AI draft"]){assert.ok(html.includes(text),text)}
  assert.doesNotMatch(html,/No hallucination|Confidence:|100%|Anki|Obsidian/);
});

test("study notes panel disables generation until a transcript exists and while queued",async()=>{
  const {exports:{StudyNotesPanel}}=await loadSource("app/components/lecture-workspace.tsx");
  const missing=renderToStaticMarkup(React.createElement(StudyNotesPanel,{hasTranscript:false,onGenerate:()=>{}}));
  assert.match(missing,/disabled/);assert.match(missing,/First create a raw transcript/);
  const queued=renderToStaticMarkup(React.createElement(StudyNotesPanel,{hasTranscript:true,state:{status:"queued"},onGenerate:()=>{}}));
  assert.match(queued,/Your notes are queued/);assert.match(queued,/disabled/);
});

test("materials explain PDF storage and online bookmark limits without fake statistics",async()=>{
  const {exports:{NotedlyApp}}=await loadSource("app/page.tsx");
  const html=renderToStaticMarkup(React.createElement(NotedlyApp,{view:"materials"}));
  assert.match(html,/PDFs are stored for download, not extracted/);
  assert.match(html,/Online videos are not downloaded or transcribed/);
  assert.doesNotMatch(html,/Maya Lin|Washington|Continuous Auto-Save|100% Indexed|3.4x realtime/);
  assert.match(html,/aria-label="Mobile navigation"/);
});

test("recording navigation protection and failure-aware mutations remain wired",async()=>{
  const hook=await readFile(new URL("../app/use-notedly.ts",import.meta.url),"utf8");
  const ui=await readFile(new URL("../app/notedly-app.tsx",import.meta.url),"utf8");
  assert.match(hook,/beforeunload/);assert.match(hook,/recordingGuard=recording\|\|saving\|\|starting/);
  assert.match(ui,/onClickCapture=\{guardNavigation\}/);assert.match(ui,/Delete this lecture\?/);assert.match(ui,/Remove this subject\?/);
  const deletion=hook.slice(hook.indexOf("async function deleteLecture"),hook.indexOf("function openRecording"));
  assert.ok(deletion.indexOf("if(!response.ok)throw")<deletion.indexOf("deleteCachedLecture"));
  assert.match(deletion,/The library has not been changed/);
});

test("Figma asset files exist and icon dimensions match exported SVG roots",async()=>{
  const ui=await readFile(new URL("../app/components/ui.tsx",import.meta.url),"utf8");
  for(const match of ui.matchAll(/\["([^"\n]+\.svg)",([\d.]+),([\d.]+)\]/g)){
    const svg=await readFile(new URL(`../public/figma/${match[1]}`,import.meta.url),"utf8");const root=svg.match(/<svg[^>]*>/)?.[0];
    assert.ok(root);assert.ok(svg.length>100);
    assert.ok(Math.abs(Number(root.match(/width="([\d.]+)"/)[1])-Number(match[2]))<.001,match[1]);
    assert.ok(Math.abs(Number(root.match(/height="([\d.]+)"/)[1])-Number(match[3]))<.001,match[1]);
  }
  await access(new URL("../public/figma/24dc9.png",import.meta.url));
  await access(new URL("../public/fonts/OFL.txt",import.meta.url));
});

test("recording controller saves captured audio and typed notes before requesting transcription",async()=>{
  const states=[],refs=[];let stateIndex=0,refIndex=0;const requests=[];let stopped=false;
  const fakeReact={useEffect:()=>{},useRef:value=>{const index=refIndex++;if(!(index in refs))refs[index]={current:value};return refs[index]},useState:value=>{const index=stateIndex++;if(!(index in states))states[index]=value;return [states[index],next=>{states[index]=typeof next==="function"?next(states[index]):next}]}};
  class Recorder{state="inactive";mimeType="audio/webm";ondataavailable;onstop;start(){this.state="recording";this.ondataavailable({data:new Blob(["synthetic captured audio"])})}pause(){this.state="paused"}resume(){this.state="recording"}stop(){this.state="inactive";this.onstop()}}
  const {exports:{useNotedly}}=await loadSource("app/use-notedly.ts",{react:fakeReact},{Blob,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>{stopped=true}}]})}},MediaRecorder:Recorder,fetch:async(path,init)=>{requests.push({path,init});return Response.json(path.endsWith("/transcript")?{status:"queued"}:{ok:true},{status:path.endsWith("/transcript")?202:201})}});
  function render(){stateIndex=0;refIndex=0;return useNotedly()}
  let app=render();app.setSubject("QA course");app=render();await app.startSession();app=render();assert.equal(app.recording,true);
  app.togglePause();app=render();assert.equal(app.paused,true);app.togglePause();app=render();assert.equal(app.paused,false);
  app.setNotes("My own words.\n\nKeep them exactly.");app=render();await app.finishSession();await new Promise(resolve=>setTimeout(resolve,0));app=render();
  assert.equal(stopped,true);assert.equal(app.recording,false);assert.equal(app.saving,false);
  assert.match(requests[0].path,/^\/api\/recordings\?id=/);assert.equal(await requests[0].init.body.text(),"synthetic captured audio");
  assert.equal(requests[1].path,"/api/lectures");const saved=JSON.parse(requests[1].init.body);assert.equal(saved.summary,"My own words.\n\nKeep them exactly.");assert.equal(saved.transcript,"");assert.equal(saved.subject,"QA course");
  assert.match(requests[2].path,/\/transcript$/);assert.equal(requests.some(request=>request.path.endsWith("/notes")),false);
});

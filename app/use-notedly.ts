"use client";
import {useEffect,useRef,useState} from "react";
import type {Lecture,Material,TranscriptState,TranscriptKind,StudyState} from "../lib/workspace";

function openCache(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open("notedly-cache",1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("lectures"))db.createObjectStore("lectures",{keyPath:"id"});if(!db.objectStoreNames.contains("audio"))db.createObjectStore("audio")};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function cacheLecture(lecture:Lecture,audio?:Blob|null){const db=await openCache();const clean={...lecture};delete clean.localAudioUrl;const tx=db.transaction(["lectures","audio"],"readwrite");tx.objectStore("lectures").put(clean);if(audio)tx.objectStore("audio").put(audio,lecture.id);await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()}
async function cachedLectures(){const db=await openCache();const values=await new Promise<Lecture[]>((resolve,reject)=>{const request=db.transaction("lectures").objectStore("lectures").getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});for(const lecture of values){const blob=await new Promise<Blob|undefined>((resolve,reject)=>{const request=db.transaction("audio").objectStore("audio").get(lecture.id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});if(blob)lecture.localAudioUrl=URL.createObjectURL(blob)}db.close();return values.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
async function deleteCachedLecture(id:string){const db=await openCache();const tx=db.transaction(["lectures","audio"],"readwrite");tx.objectStore("lectures").delete(id);tx.objectStore("audio").delete(id);await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()}
async function cacheTranscript(id:string,transcript:string){const db=await openCache();const tx=db.transaction("lectures","readwrite");const store=tx.objectStore("lectures");const request=store.get(id);request.onsuccess=()=>{if(request.result)store.put({...request.result,transcript})};await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()}


export function useNotedly(){
  const [lectures,setLectures]=useState<Lecture[]>([]);
  const [subjects,setSubjects]=useState<string[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [subject,setSubject]=useState("");
  const [newSubject,setNewSubject]=useState("");
  const [subjectOpen,setSubjectOpen]=useState(false);
  const [managerOpen,setManagerOpen]=useState(false);
  const [recording,setRecording]=useState(false);
  const [paused,setPaused]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true);
  const [materials,setMaterials]=useState<Material[]>([]);
  const [importOpen,setImportOpen]=useState(false);
  const [importMode,setImportMode]=useState<"file"|"link">("file");
  const [videoUrl,setVideoUrl]=useState("");
  const [uploading,setUploading]=useState(false);
  const [openMaterialId,setOpenMaterialId]=useState("");
  const [transcriptions,setTranscriptions]=useState<Record<string,TranscriptState>>({});
  const [transcriptionReady,setTranscriptionReady]=useState(false);
  const [notesReady,setNotesReady]=useState(false);
  const [healthChecked,setHealthChecked]=useState(false);
  const [starting,setStarting]=useState(false);
  const [mutating,setMutating]=useState(false);
  const [studyJobs,setStudyJobs]=useState<Record<string,StudyState>>({});
  const notesPollingRef=useRef(new Set<string>());
  const pollingRef=useRef(new Set<string>());
  const mediaRecorderRef=useRef<MediaRecorder|null>(null);
  const audioChunksRef=useRef<Blob[]>([]);
  const audioStreamRef=useRef<MediaStream|null>(null);
  const recordingGuard=recording||saving||starting;
  useEffect(()=>{if(!recordingGuard)return;function warn(event:BeforeUnloadEvent){event.preventDefault();event.returnValue=""}window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[recordingGuard]);

  useEffect(()=>{Promise.all([
    fetch("/api/lectures").then(r=>r.ok?r.json():[]),
    fetch("/api/subjects").then(r=>r.ok?r.json():[]),
    fetch("/api/materials").then(r=>r.ok?r.json():[])
  ]).then(async([savedLectures,savedSubjects,savedMaterials]:[Lecture[],{name:string}[],Material[]])=>{const local=await cachedLectures().catch(()=>[]);const merged=[...savedLectures,...local.filter(item=>!savedLectures.some(saved=>saved.id===item.id)).map(item=>({...item,localOnly:true}))];setLectures(merged);setSelectedId(merged[0]?.id??"");setMaterials(savedMaterials);for(const lecture of savedLectures){if(lecture.audioKey&&!lecture.transcript)void checkTranscript("lectures",lecture.id);if(lecture.transcript)void checkStudyNotes("lectures",lecture.id)}for(const material of savedMaterials){if(["audio","video"].includes(material.kind)&&!material.transcript)void checkTranscript("materials",material.id);if(material.transcript)void checkStudyNotes("materials",material.id)}const localSubjects=JSON.parse(localStorage.getItem("notedly-subjects")||"[]") as string[];setSubjects(Array.from(new Set([...savedSubjects.map(s=>s.name),...localSubjects])).sort())}).catch(async()=>{const local=await cachedLectures().catch(()=>[]);setLectures(local);setSelectedId(local[0]?.id??"");setSubjects(JSON.parse(localStorage.getItem("notedly-subjects")||"[]"));setNotice("Working offline — new lectures will stay safely on this device.")}).finally(()=>setLoading(false))},[]);
  useEffect(()=>{if(!recording||paused)return;const timer=window.setInterval(()=>setElapsed(v=>v+1),1000);return()=>clearInterval(timer)},[recording,paused]);
  useEffect(()=>{let alive=true;async function check(){const [speech,study]=await Promise.all([fetch("/api/transcription").then(r=>r.json()).catch(()=>null),fetch("/api/notes").then(r=>r.json()).catch(()=>null)]);if(alive){setTranscriptionReady(Boolean(speech?.ready));setNotesReady(Boolean(study?.ready));setHealthChecked(true)}}void check();const timer=window.setInterval(check,20000);return()=>{alive=false;clearInterval(timer)}},[]);
  useEffect(()=>{
    const pending=Object.entries(transcriptions).filter(([,job])=>["queued","running"].includes(job.status));
    if(!pending.length)return;
    const timer=window.setInterval(()=>{for(const [key] of pending){const [kind,id]=key.split(":");void checkTranscript(kind as TranscriptKind,id)}},3000);
    return()=>clearInterval(timer);
  },[transcriptions]);
  useEffect(()=>{
    const pending=Object.entries(studyJobs).filter(([,job])=>["queued","running"].includes(job.status));
    if(!pending.length)return;
    const timer=window.setInterval(()=>{for(const [key] of pending){const [kind,id]=key.split(":");void checkStudyNotes(kind as TranscriptKind,id)}},3000);
    return()=>clearInterval(timer);
  },[studyJobs]);

  async function startSession(){if(!subject||recordingGuard)return;setStarting(true);setNotice("");try{if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined")throw new Error("unsupported");const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});audioStreamRef.current=stream;audioChunksRef.current=[];const recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)audioChunksRef.current.push(e.data)};recorder.start(1000);mediaRecorderRef.current=recorder;setSubjectOpen(false);setNotes("");setElapsed(0);setRecording(true);setPaused(false)}catch(error){audioStreamRef.current?.getTracks().forEach(track=>track.stop());setNotice(error instanceof Error&&error.message==="unsupported"?"This browser cannot record audio. Use a supported browser on localhost or HTTPS.":"Microphone access failed. Check browser permission and that a microphone is connected, then try again.")}finally{setStarting(false)}}
  function stopAudio(){return new Promise<Blob|null>(resolve=>{const r=mediaRecorderRef.current;if(!r||r.state==="inactive"){resolve(null);return}r.onstop=()=>{const blob=new Blob(audioChunksRef.current,{type:r.mimeType||"audio/webm"});audioStreamRef.current?.getTracks().forEach(t=>t.stop());resolve(blob)};r.stop()})}
  function togglePause(){if(saving)return;const recorder=mediaRecorderRef.current;if(paused){recorder?.resume();setPaused(false)}else{recorder?.pause();setPaused(true)}}
  async function finishSession(){
    if(saving||!recording)return;
    setSaving(true);
    const audio=await stopAudio();
    const now=new Date();
    const id=crypto.randomUUID();
    const lecture:Lecture={id,subject,title:`${subject} lecture — ${now.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`,transcript:"",summary:notes,createdAt:now.toISOString(),duration:elapsed,audioKey:audio?`lectures/${id}`:undefined,localAudioUrl:audio?URL.createObjectURL(audio):undefined,localOnly:true};
    let savedLocally=false;
    try{await cacheLecture(lecture,audio);savedLocally=true}catch{}
    setLectures(items=>[lecture,...items]);setSelectedId(id);setRecording(false);setPaused(false);
    try{
      if(audio){const upload=await fetch(`/api/recordings?id=${encodeURIComponent(id)}`,{method:"PUT",headers:{"content-type":audio.type||"audio/webm"},body:audio});if(!upload.ok)throw new Error("Recording upload failed")}
      const response=await fetch("/api/lectures",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(lecture)});
      if(!response.ok)throw new Error("Lecture save failed");
      lecture.localOnly=false;
      setLectures(items=>items.map(item=>item.id===id?{...item,localOnly:false}:item));
      void cacheLecture(lecture).catch(()=>undefined);
      setNotice("Recording and your notes saved. Starting the raw transcript…");
      if(audio)void startTranscript("lectures",id);
    }catch(error){
      const message=error instanceof Error?error.message:"Unable to save lecture";
      setNotice(savedLocally?`${message}. Your recording and notes are saved on this device.`:`${message}. Keep this tab open and download your recording before leaving.`);
    }finally{setSaving(false)}
  }

  async function addSubject(){const name=newSubject.trim();if(mutating||!name)return false;if(name.length>100){setNotice("Subject names must be 100 characters or fewer.");return false}if(subjects.some(s=>s.toLowerCase()===name.toLowerCase())){setNotice("That subject already exists.");return false}setMutating(true);try{const response=await fetch("/api/subjects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name})});if(!response.ok)throw new Error();const next=[...subjects,name].sort((a,b)=>a.localeCompare(b));setSubjects(next);try{localStorage.setItem("notedly-subjects",JSON.stringify(next))}catch{}setNewSubject("");setSubject(name);setNotice(`${name} added.`);return true}catch{setNotice("Subject could not be saved. Your list is unchanged. Please try again.");return false}finally{setMutating(false)}}
  async function removeSubject(name:string){if(mutating||recordingGuard)return false;setMutating(true);try{const response=await fetch(`/api/subjects?name=${encodeURIComponent(name)}`,{method:"DELETE"});if(!response.ok)throw new Error();const next=subjects.filter(item=>item!==name);setSubjects(next);try{localStorage.setItem("notedly-subjects",JSON.stringify(next))}catch{}if(subject===name)setSubject("");setNotice(`${name} removed. Existing lectures remain in your library.`);return true}catch{setNotice("Subject could not be removed. Your list is unchanged. Please try again.");return false}finally{setMutating(false)}}
  async function deleteLecture(lecture:Lecture){if(mutating||recordingGuard)return false;setMutating(true);try{const response=await fetch(`/api/lectures?id=${encodeURIComponent(lecture.id)}`,{method:"DELETE"});if(!response.ok)throw new Error();await deleteCachedLecture(lecture.id).catch(()=>undefined);setLectures(items=>items.filter(item=>item.id!==lecture.id));setSelectedId("");setNotice("Lecture and its saved recording were deleted.");return true}catch{setNotice("Could not delete the lecture. The library has not been changed; try again.");return false}finally{setMutating(false)}}
  function openRecording(){if(saving||recording)return;if(!subjects.length){setManagerOpen(true);setNotice("Add your first subject before recording.")}else{setSubject(subjects[0]);setSubjectOpen(true)}}
  async function uploadFile(file:File){const allowed=["application/pdf","audio/mpeg","audio/mp4","audio/wav","audio/webm","video/mp4","video/webm","video/quicktime"];if(!allowed.includes(file.type)){setNotice("Choose a PDF, MP3, WAV, M4A, MP4, WebM, or MOV file.");return}if(file.size>100*1024*1024){setNotice("Files must be 100 MB or smaller.");return}setUploading(true);try{const response=await fetch(`/api/materials?name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type)}`,{method:"PUT",headers:{"content-type":file.type},body:file});if(!response.ok)throw new Error();const material=await response.json() as Material;setMaterials(items=>[material,...items]);setImportOpen(false);setNotice(`${file.name} uploaded.`);if(["audio","video"].includes(material.kind))void startTranscript("materials",material.id)}catch{setNotice("Upload failed. Check the connection and try again.")}finally{setUploading(false)}}
  async function addVideoLink(){let parsed:URL;try{parsed=new URL(videoUrl)}catch{setNotice("Enter a complete video URL beginning with https://");return}if(parsed.protocol!=="https:"){setNotice("Only secure HTTPS links are accepted.");return}setUploading(true);try{const response=await fetch("/api/materials",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:parsed.toString()})});if(!response.ok)throw new Error();const material=await response.json() as Material;setMaterials(items=>[material,...items]);setVideoUrl("");setImportOpen(false);setNotice("Video link saved.")}catch{setNotice("Couldn’t save that link. Please try again.")}finally{setUploading(false)}}

  function applyTranscript(kind:TranscriptKind,id:string,job:TranscriptState){
    setTranscriptions(values=>({...values,[`${kind}:${id}`]:job}));
    if(job.status!=="complete"||typeof job.transcript!=="string")return;
    const transcript=job.transcript;
    if(kind==="lectures"){
      setLectures(items=>items.map(item=>item.id===id?{...item,transcript}:item));
      void cacheTranscript(id,transcript).catch(()=>undefined);
    }else{setMaterials(items=>items.map(item=>item.id===id?{...item,transcript}:item));setOpenMaterialId(id)}
    if(transcript.trim())void startStudyNotes(kind,id);
  }
  async function checkTranscript(kind:TranscriptKind,id:string){
    const key=`${kind}:${id}`;
    if(pollingRef.current.has(key))return;
    pollingRef.current.add(key);
    try{
      const response=await fetch(`/api/${kind}/${encodeURIComponent(id)}/transcript`);
      const job=await response.json() as TranscriptState;
      if(!response.ok)throw new Error(job.error||"Transcription is unavailable");
      if(job.status!=="not_started")applyTranscript(kind,id,job);
    }catch{/* A temporary disconnect must not discard a queued transcript. */}
    finally{pollingRef.current.delete(key)}
  }
  async function startTranscript(kind:TranscriptKind,id:string){
    const key=`${kind}:${id}`;
    if(["queued","running"].includes(transcriptions[key]?.status??""))return;
    setTranscriptions(values=>({...values,[key]:{status:"queued"}}));
    try{
      const response=await fetch(`/api/${kind}/${encodeURIComponent(id)}/transcript`,{method:"POST"});
      let job:TranscriptState;
      try{job=await response.json() as TranscriptState}catch{throw new Error("Unable to start transcription. Your saved recording is unchanged.")}
      if(!response.ok)throw new Error(job.error||"Unable to start transcription");
      applyTranscript(kind,id,job);
    }catch(error){
      const message=error instanceof Error?error.message:"Unable to start transcription";
      setTranscriptions(values=>({...values,[key]:{status:"failed",error:message}}));
      setNotice(message);
    }
  }
  function transcriptStatus(kind:TranscriptKind,id:string){const status=transcriptions[`${kind}:${id}`]?.status;return status==="queued"?"Queued for transcription":status==="running"?"Transcribing locally with Whisper Small…":status==="failed"?"Transcription needs a retry":status==="complete"?"Transcript ready":""}
  async function checkStudyNotes(kind:TranscriptKind,id:string){
    const key=`${kind}:${id}`;
    if(notesPollingRef.current.has(key))return;
    notesPollingRef.current.add(key);
    try{
      const response=await fetch(`/api/${kind}/${encodeURIComponent(id)}/notes`);
      const result=await response.json() as StudyState;
      if(!response.ok)throw new Error(result.error||"Unable to load study notes");
      setStudyJobs(values=>result.status==="not_started"&&["queued","running"].includes(values[key]?.status??"")?values:{...values,[key]:result});
    }catch{/* Retain any queued or saved draft during a temporary disconnect. */}
    finally{notesPollingRef.current.delete(key)}
  }
  async function startStudyNotes(kind:TranscriptKind,id:string){
    const key=`${kind}:${id}`;
    if(["queued","running"].includes(studyJobs[key]?.status??""))return;
    setStudyJobs(values=>({...values,[key]:{status:"queued"}}));
    try{
      const response=await fetch(`/api/${kind}/${encodeURIComponent(id)}/notes`,{method:"POST"});
      let result:StudyState;
      try{result=await response.json() as StudyState}catch{throw new Error("The notes service returned an invalid response.")}
      if(!response.ok)throw new Error(result.error||"Unable to generate study notes");
      setStudyJobs(values=>({...values,[key]:result}));
    }catch(error){setStudyJobs(values=>({...values,[key]:{status:"failed",error:error instanceof Error?error.message:"Unable to generate study notes"}}))}
  }


  return {lectures,subjects,selectedId,setSelectedId,subject,setSubject,newSubject,setNewSubject,subjectOpen,setSubjectOpen,managerOpen,setManagerOpen,recording,paused,elapsed,notes,setNotes,saving,notice,setNotice,loading,materials,importOpen,setImportOpen,importMode,setImportMode,videoUrl,setVideoUrl,uploading,openMaterialId,setOpenMaterialId,transcriptions,transcriptionReady,notesReady,healthChecked,starting,mutating,recordingGuard,studyJobs,startSession,togglePause,finishSession,addSubject,removeSubject,deleteLecture,openRecording,uploadFile,addVideoLink,startTranscript,startStudyNotes};
}

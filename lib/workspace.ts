export type Lecture = { id:string; subject:string; title:string; transcript:string; summary:string; createdAt:string; duration:number; audioKey?:string; localAudioUrl?:string; localOnly?:boolean };
export type Material = { id:string; name:string; kind:"pdf"|"audio"|"video"|"link"; sourceUrl?:string; status:string; transcript?:string; summary?:string; error?:string; createdAt:string };
export type JobStatus = "not_started"|"queued"|"running"|"complete"|"failed";
export type TranscriptState = {status:JobStatus;transcript?:string;error?:string};
export type TranscriptKind = "lectures"|"materials";
export type StudyEntry = {text:string;quote:string;sources:{id:string;timestamp:string|null}[]};
export type StudyDraft = {model:string;createdAt:string;sections:Record<string,StudyEntry[]>;warnings:string[]};
export type StudyState = {status:JobStatus;notes?:StudyDraft;error?:string};
export const studyLabels:Record<string,string> = {overview:"Overview",concepts:"Key concepts",definitions:"Definitions",examples:"Examples",assignments:"Assignments & deadlines",unclear:"Needs clarification"};
export function formatTime(value:number){const total=Math.max(0,Math.floor(value||0));return total>=3600?`${Math.floor(total/3600)}:${String(Math.floor(total/60)%60).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`:`${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`}
export function formatDate(value:string){return new Date(value).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
export function savedNotes(lecture:Lecture){return ["Transcribing your recording and preparing class notes…","Your audio is saved. Automatic transcription will be available when the service reconnects.","No spoken content was captured. Add notes to the transcript and save again."].includes(lecture.summary)?"":lecture.summary}
export function filterLectures(lectures:Lecture[],query="",subject="",sort="newest"){
  const needle=query.trim().toLocaleLowerCase();
  return lectures.filter(item=>(!subject||item.subject===subject)&&(!needle||[item.title,item.subject,item.transcript,savedNotes(item)].some(value=>value.toLocaleLowerCase().includes(needle)))).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title):sort==="oldest"?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt));
}
export function transcriptSegments(transcript:string){
  return transcript.split(/\r?\n/).filter(line=>line.trim()).map((line,index)=>{const match=line.match(/^\s*\[((?:\d{2}:)?\d{2}:\d{2})\]\s*/);return {id:`segment-${index}`,timestamp:match?.[1],text:line.slice(match?.[0].length??0)}});
}
export function processingLabel(transcript:string|undefined,job?:TranscriptState,notes?:StudyState){
  if(job?.status==="failed")return {text:"Transcription needs a retry",tone:"error"};
  if(job?.status==="running")return {text:"Transcribing",tone:"working"};
  if(job?.status==="queued")return {text:"Transcript queued",tone:"working"};
  if(notes?.status==="failed")return {text:"Study notes need a retry",tone:"error"};
  if(notes?.status==="running")return {text:"Generating notes",tone:"working"};
  if(notes?.status==="queued")return {text:"Study notes queued",tone:"working"};
  if(notes?.status==="complete")return {text:"Study notes ready",tone:"success"};
  if(transcript?.trim())return {text:"Transcript ready",tone:"success"};
  if(job?.status==="complete")return {text:"No speech detected",tone:"muted"};
  return {text:"Recording saved",tone:"muted"};
}
export function studyNotesText(draft:StudyDraft){return Object.entries(draft.sections).filter(([,entries])=>entries.length).map(([name,entries])=>`${studyLabels[name]??name}\n${entries.map(entry=>`• ${entry.text} ${entry.sources.map(source=>`[${source.timestamp??source.id}]`).join(" ")}`).join("\n")}`).join("\n\n")}

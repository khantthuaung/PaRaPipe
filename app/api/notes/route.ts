import { notesRequest,NOTES_MODEL } from "../../../lib/study-notes";
export async function GET(){try{const health=await notesRequest("/health");return Response.json({ready:Boolean(health.ready),model:NOTES_MODEL,localOnly:true})}catch(error){return Response.json({ready:false,model:NOTES_MODEL,localOnly:true,error:error instanceof Error?error.message:"Notes unavailable"})}}

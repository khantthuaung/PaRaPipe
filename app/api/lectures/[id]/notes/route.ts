import { handleStudyNotes } from "../../../../../lib/study-notes";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){return handleStudyNotes("lectures",(await params).id,false)}
export async function POST(_request:Request,{params}:Context){return handleStudyNotes("lectures",(await params).id,true)}

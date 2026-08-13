export type MlResult = {
  transcript?: string;
  summary?: string;
  error?: string;
  detail?: string;
};

export async function readMlResponse(response: Response): Promise<MlResult> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as MlResult;
  } catch {
    return { error: response.ok ? "The transcription service returned an invalid response." : text.slice(0, 500) };
  }
}

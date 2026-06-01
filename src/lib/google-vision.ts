import { GoogleGenerativeAI } from '@google/generative-ai';

export const VISION_CONFIG_ERROR =
  'Gemini API is not configured. Please add GEMINI_API_KEY to your .env.local file. Get a free key at https://aistudio.google.com/apikey';

export function isVisionConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export interface ExtractedData {
  [key: string]: string;
}

export interface OCRResult {
  success: boolean;
  data: ExtractedData[];
  headers: string[];
  error?: string;
}

const PROMPT = `You are a pharmacy inventory assistant. Extract all medicine/drug data from this image into a JSON array.

Return ONLY a valid JSON array like this (no markdown, no explanation):
[
  {
    "name": "medicine name",
    "manufacturer": "manufacturer name",
    "batchNo": "batch number",
    "expiryDate": "expiry date as found",
    "quantity": "quantity number",
    "purchasePrice": "price number",
    "mrp": "mrp number",
    "category": "category if visible",
    "supplier": "supplier if visible",
    "gstRate": "gst % if visible",
    "isScheduleH": "yes or no if visible"
  }
]

Rules:
- Extract every row from the table
- Use empty string "" for missing fields
- Keep numbers as strings
- Return [] if no medicine data found`;

const HEADERS = [
  'name', 'manufacturer', 'batchNo', 'expiryDate', 'quantity',
  'purchasePrice', 'mrp', 'category', 'supplier', 'gstRate', 'isScheduleH',
];

export async function processFileWithVision(
  base64File: string,
  fileType: 'image' | 'pdf'
): Promise<OCRResult> {
  if (!isVisionConfigured()) {
    return { success: false, data: [], headers: [], error: VISION_CONFIG_ERROR };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const mimeType = fileType === 'pdf' ? 'application/pdf' : 'image/jpeg';
  const base64Data = base64File.replace(/^data:[^;]+;base64,/, '');

  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent([
        PROMPT,
        { inlineData: { data: base64Data, mimeType } },
      ]);

      const text = result.response.text().trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { success: false, data: [], headers: [], error: 'No structured data found in image' };
      }

      const parsed: Record<string, string>[] = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { success: false, data: [], headers: [], error: 'No medicine data found in image' };
      }

      const data = parsed.filter((row) => Object.values(row).some((v) => v?.trim()));
      return { success: true, data, headers: HEADERS };
    } catch (err: any) {
      lastError = err?.message || 'Failed to process file';
      const is503 = lastError.includes('503') || lastError.includes('Service Unavailable');
      if (attempt < 3 && is503) {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      } else {
        break;
      }
    }
  }

  return { success: false, data: [], headers: [], error: lastError };
}

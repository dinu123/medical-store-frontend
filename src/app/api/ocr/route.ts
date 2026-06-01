import { NextRequest, NextResponse } from 'next/server';
import { buildStandardOcrResponse } from '@/lib/bulk-upload-mapping';
import { processFileWithVision, isVisionConfigured, VISION_CONFIG_ERROR } from '@/lib/google-vision';

const DEMO_ROWS = [
  { name: 'Paracetamol', category: 'Analgesic', manufacturer: 'Cipla Ltd', batchNo: 'PCM001', expiryDate: '31-12-2026', supplier: 'Cipla Distributors', purchasePrice: '25.5', mrp: '30', quantity: '150', minStockLevel: '20', gstRate: '5', isScheduleH: 'no' },
  { name: 'Amoxicillin', category: 'Antibiotic', manufacturer: 'Sun Pharma', batchNo: 'AMX002', expiryDate: '15-06-2026', supplier: 'Sun Pharma Distributors', purchasePrice: '45', mrp: '54', quantity: '80', minStockLevel: '15', gstRate: '12', isScheduleH: 'yes' },
];

const DEMO_HEADERS = ['name', 'category', 'manufacturer', 'batchNo', 'expiryDate', 'supplier', 'purchasePrice', 'mrp', 'quantity', 'minStockLevel', 'gstRate', 'isScheduleH'];

function demoResponse(message?: string) {
  return NextResponse.json(
    buildStandardOcrResponse(
      DEMO_HEADERS,
      DEMO_ROWS,
      message || 'Demo mode: Add GEMINI_API_KEY to .env.local for real OCR. Get a free key at https://aistudio.google.com/apikey',
      { isDemo: true }
    )
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { base64File, fileType } = body;

    if (!base64File || !fileType) {
      return NextResponse.json({ error: 'Missing base64File or fileType' }, { status: 400 });
    }

    if (!['image', 'pdf'].includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file type. Must be "image" or "pdf"' }, { status: 400 });
    }

    if (!isVisionConfigured()) {
      return demoResponse();
    }

    const result = await processFileWithVision(base64File, fileType as 'image' | 'pdf');

    if (!result.success) {
      const msg = result.error || 'Failed to process file';
      if (msg.includes(VISION_CONFIG_ERROR)) return demoResponse();
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({
      ...buildStandardOcrResponse(
        result.headers,
        result.data,
        `Successfully extracted ${result.data.length} medicine record(s) from image`
      ),
      visionConfigured: true,
    });
  } catch (error) {
    console.error('OCR API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

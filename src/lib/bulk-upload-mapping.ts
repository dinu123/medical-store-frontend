export type FieldMapping = Record<string, string>;

/** Same column keys in mapping dropdown for CSV, image, and PDF uploads */
export const STANDARD_UPLOAD_COLUMN_KEYS = [
  'name',
  'manufacturer',
  'category',
  'batchNo',
  'expiryDate',
  'quantity',
  'purchasePrice',
  'mrp',
  'supplier',
  'isScheduleH',
  'minStockLevel',
  'gstRate',
] as const;

export type StandardColumnKey = (typeof STANDARD_UPLOAD_COLUMN_KEYS)[number];

/** Normalize column header for comparison (OCR often returns "Exp Dt", "CGST%", etc.) */
export function normalizeHeaderLabel(header: string): string {
  return header
    .toLowerCase()
    .replace(/[%#.:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map uploaded file columns (CSV or OCR invoice) to app inventory fields.
 * Supports pharmacy invoice layouts: Description, Mfr, Batch No, Exp Dt, Qty, Rate, MRP, CGST%, etc.
 */
export function autoDetectFieldMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const normalizedEntries = headers.map((h) => ({
    original: h,
    normalized: normalizeHeaderLabel(h),
  }));

  const aliases: Record<string, string[]> = {
    name: [
      'medicine name',
      'medicine',
      'drug name',
      'drug',
      'product name',
      'product',
      'item name',
      'item',
      'name',
      'description',
      'desc',
      'particulars',
      'medicine description',
    ],
    manufacturer: ['manufacturer', 'mfr', 'mfg', 'manuf', 'company', 'make', 'maker'],
    category: ['category', 'type', 'class', 'group', 'therapeutic class', 'pack type'],
    batchNo: ['batchno', 'batch no', 'batch number', 'batch', 'lot no', 'lot number', 'lot'],
    expiryDate: [
      'expirydate',
      'expiry date',
      'expiry',
      'exp date',
      'exp dt',
      'expdt',
      'exp',
      'best before',
      'use before',
      'valid upto',
    ],
    quantity: ['stockquantity', 'quantity', 'qty', 'qnty', 'stock', 'stock quantity', 'units'],
    purchasePrice: [
      'price',
      'purchase price',
      'cost',
      'purchaseprice',
      'unit price',
      'rate',
      'purchase rate',
      'unit rate',
      'buying price',
      'net rate',
      'ptr',
    ],
    mrp: ['mrp', 'selling price', 'retail price', 'max retail price', 'list price'],
    supplier: ['supplier', 'vendor', 'distributor', 'dealer', 'party name'],
    isScheduleH: ['isscheduleh', 'schedule h', 'scheduleh', 'schedule', 'sch h'],
    minStockLevel: ['minstocklevel', 'min stock level', 'min stock', 'minimum stock', 'reorder level'],
    gstRate: ['gstrate', 'gst rate', 'gst', 'tax rate', 'cgst', 'cgst%', 'sgst', 'igst', 'tax %', 'gst%'],
  };

  const usedHeaders = new Set<string>();

  const tryAssign = (appField: string, headerOriginal: string) => {
    if (mapping[appField] || usedHeaders.has(headerOriginal)) return false;
    mapping[appField] = headerOriginal;
    usedHeaders.add(headerOriginal);
    return true;
  };

  // Pass 1: exact normalized match
  Object.entries(aliases).forEach(([appField, keywordList]) => {
    for (const { original, normalized } of normalizedEntries) {
      if (usedHeaders.has(original)) continue;
      if (keywordList.some((kw) => normalized === normalizeHeaderLabel(kw))) {
        tryAssign(appField, original);
        break;
      }
    }
  });

  // Pass 2: header contains alias or alias contains header (OCR variants: "Batch No.", "Exp. Dt")
  Object.entries(aliases).forEach(([appField, keywordList]) => {
    if (mapping[appField]) return;
    for (const { original, normalized } of normalizedEntries) {
      if (usedHeaders.has(original)) continue;
      const matched = keywordList.some((kw) => {
        const nkw = normalizeHeaderLabel(kw);
        return normalized.includes(nkw) || nkw.includes(normalized);
      });
      if (matched) {
        tryAssign(appField, original);
        break;
      }
    }
  });

  // Pass 3: invoice-specific single-token headers (e.g. column titled exactly "Mfr")
  const tokenMap: Record<string, string> = {
    mfr: 'manufacturer',
    mfg: 'manufacturer',
    qty: 'quantity',
    rate: 'purchasePrice',
    mrp: 'mrp',
    desc: 'name',
  };
  for (const { original, normalized } of normalizedEntries) {
    if (usedHeaders.has(original)) continue;
    const token = normalized.split(' ')[0];
    const appField = tokenMap[token];
    if (appField && !mapping[appField]) {
      tryAssign(appField, original);
    }
  }

  return mapping;
}

/**
 * Convert raw file columns (CSV headers or OCR labels) into standard keys.
 * Mapping dropdown always uses STANDARD_UPLOAD_COLUMN_KEYS for every upload type.
 */
export function normalizeUploadTable(
  rawHeaders: string[],
  rawRows: Record<string, string>[]
): {
  rows: Record<string, string>[];
  fieldMapping: FieldMapping;
} {
  const sourceToStandard = autoDetectFieldMapping(rawHeaders);

  const rows = rawRows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [standardKey, sourceHeader] of Object.entries(sourceToStandard)) {
      const value = row[sourceHeader];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        normalized[standardKey] = String(value).trim();
      }
    }
    return normalized;
  });

  const fieldMapping = buildStandardFieldMapping(rows);

  return { rows, fieldMapping };
}

/** API/OCR responses use the same standard columns as the mapping UI */
export function buildStandardOcrResponse(
  rawHeaders: string[],
  rawData: Record<string, string>[],
  message: string,
  extra?: Record<string, unknown>
) {
  const { rows, fieldMapping } = normalizeUploadTable(rawHeaders, rawData);
  return {
    success: true,
    data: rows,
    headers: [...STANDARD_UPLOAD_COLUMN_KEYS],
    fieldMapping,
    message,
    ...extra,
  };
}

/** Map each app field to the standard column key when that column has data */
export function buildStandardFieldMapping(rows: Record<string, string>[]): FieldMapping {
  const mapping: FieldMapping = {};
  for (const key of STANDARD_UPLOAD_COLUMN_KEYS) {
    if (rows.some((row) => row[key]?.trim())) {
      mapping[key] = key;
    }
  }
  return mapping;
}

/** Parse expiry from CSV/OCR values (e.g. 10-2025, 31-12-2025, ISO dates). */
export function parseExpiryDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  const mmYyyy = v.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (mmYyyy) {
    const month = parseInt(mmYyyy[1], 10);
    const year = parseInt(mmYyyy[2], 10);
    if (month >= 1 && month <= 12) {
      return new Date(year, month, 0).toISOString().split('T')[0];
    }
  }

  const ddMmYyyy = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddMmYyyy) {
    const day = parseInt(ddMmYyyy[1], 10);
    const month = parseInt(ddMmYyyy[2], 10) - 1;
    const year = parseInt(ddMmYyyy[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const yyyyMmDd = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyyMmDd) {
    const date = new Date(
      parseInt(yyyyMmDd[1], 10),
      parseInt(yyyyMmDd[2], 10) - 1,
      parseInt(yyyyMmDd[3], 10)
    );
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

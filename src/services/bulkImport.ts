import ExcelJS from "exceljs";
import type { Asset } from "./assets";
import { createAsset, listAssets } from "./assets";
import { checkLicenseBeforeCreate } from './license';
import { listProperties } from "./properties";
import { listItemTypes } from "./itemTypes";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { getAccessiblePropertyIdsForCurrentUser } from "./userAccess";
import { getAccessibleDepartmentsForCurrentUser } from "./userDeptAccess";
import { listDepartments } from "./departments";

export type BulkAssetRow = {
  // id is optional; when omitted, the system will auto-generate based on type+property
  id?: string;
  name: string;
  type: string;
  property: string; // property code (e.g., PROP-001)
  department?: string; // optional; defaults to uploader's department if finance
  quantity: number;
  purchaseDate?: string | null;
  expiryDate?: string | null;
  poNumber?: string | null;
  condition?: string | null;
  status: string;
  location?: string | null;
  description?: string | null;
  serialNumber?: string | null;
  amcEnabled?: boolean;
  amcStartDate?: string | null;
  amcEndDate?: string | null;
};

const COLUMN_CONFIG = [
  { header: "Item Name", key: "name", required: true, width: 30 },
  { header: "Quantity", key: "quantity", required: true, width: 12 },
  { header: "Item Type", key: "type", required: true, width: 20 },
  { header: "Condition", key: "condition", required: true, width: 15 },
  { header: "Property", key: "property", required: true, width: 25 },
  { header: "Department", key: "department", required: true, width: 20 },
  { header: "Location", key: "location", required: true, width: 25 },
  { header: "Serial Number", key: "serialNumber", required: false, width: 20 },
  { header: "Purchase Date", key: "purchaseDate", required: false, width: 15 },
  { header: "Expiry Date", key: "expiryDate", required: false, width: 15 },
  { header: "PO Number", key: "poNumber", required: false, width: 15 },
  { header: "Enable AMC", key: "amcEnabled", required: false, width: 15 },
  { header: "AMC Start Date", key: "amcStartDate", required: false, width: 15 },
  { header: "AMC End Date", key: "amcEndDate", required: false, width: 15 },
  { header: "Description", key: "description", required: false, width: 40 },
] as const;

export async function downloadAssetTemplate(filename = "SAMS_Bulk_Import_Template.xlsx") {
  // Gather dropdown sources
  const types = (await listItemTypes()).map(t => t.name);
  let properties: { id: string; name: string }[] = [];
  try {
    properties = await listProperties();
  } catch {
    properties = [];
  }
  // Determine current user role and accessible properties
  let currentRole = "";
  try {
    const raw = localStorage.getItem('auth_user');
    if (raw) currentRole = (JSON.parse(raw)?.role || '').toString();
  } catch {}
  const isAdmin = (currentRole || '').toLowerCase() === 'admin';
  let accessibleSet: Set<string> = new Set();
  try {
    accessibleSet = await getAccessiblePropertyIdsForCurrentUser();
  } catch {}
  const allPropertyCodes = properties.map(p => p.id);
  const propertyCodes = isAdmin || accessibleSet.size === 0
    ? allPropertyCodes
    : allPropertyCodes.filter((code) => accessibleSet.has(code));
  const conditions = ["Excellent", "Good", "Fair", "Poor", "Damaged"];
  // Fetch department names from Supabase settings > departments (fallback to a small static list)
  let departments: string[] = [];
  try {
    const list = await listDepartments();
    const names = list.map((d) => (d.name || "").trim()).filter(Boolean);
    // Deduplicate, preserve order by first appearance
    const seen = new Set<string>();
    for (const n of names) if (!seen.has(n)) { seen.add(n); departments.push(n); }
    if (departments.length === 0) throw new Error("EMPTY_DEPARTMENTS");
  } catch {
    departments = ["IT","HR","Finance","Operations"]; // offline fallback
  }

  const book = new ExcelJS.Workbook();
  const input = book.addWorksheet("Assets");
  const lists = book.addWorksheet("Lists");

  // Fill Lists sheet
  lists.getCell("A1").value = "Types";
  types.forEach((v, i) => (lists.getCell(i + 2, 1).value = v));
  lists.getCell("B1").value = "PropertyCodes";
  propertyCodes.forEach((v, i) => (lists.getCell(i + 2, 2).value = v));
  lists.getCell("C1").value = "Conditions";
  conditions.forEach((v, i) => (lists.getCell(i + 2, 3).value = v));
  lists.getCell("D1").value = "Departments";
  departments.forEach((v, i) => (lists.getCell(i + 2, 4).value = v));
  lists.state = "veryHidden";

  // Header
  const headerRow = input.addRow(COLUMN_CONFIG.map(c => c.required ? `${c.header}*` : c.header));
  headerRow.height = 24;
  
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' } // Professional Dark Blue
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
  });

  // Sample row
  const sampleRow = input.addRow([
    "Sample Laptop", // Item Name
    10,              // Quantity
    types[0] || "Electronics", // Item Type
    "Good",          // Condition
    propertyCodes[0] || "", // Property
    departments[0] || "",   // Department
    "Floor 2, IT Room",     // Location
    "SN-ABC-12345",         // Serial Number
    "2025-01-15",           // Purchase Date
    "2027-01-15",           // Expiry Date
    "PO-1001",              // PO Number
    "No",                   // Enable AMC
    "",                     // AMC Start Date
    "",                     // AMC End Date
    "15\" laptop, 16GB RAM" // Description
  ]);
  
  // Style sample row
  sampleRow.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    if (typeof cell.value === 'number') cell.alignment.horizontal = 'right';
  });

  // Column widths
  input.columns = COLUMN_CONFIG.map((c) => ({ width: c.width } as any));

  // Data validation for rows 2..1000
  const maxRows = 1000;
  const setListValidation = (col: number, formulae: string | string[], allowBlank = true) => {
    for (let r = 2; r <= maxRows; r++) {
      input.getCell(r, col).dataValidation = {
        type: 'list',
        allowBlank,
        formulae: Array.isArray(formulae) ? formulae : [formulae],
        showErrorMessage: true,
        error: 'Select a value from the dropdown list',
      } as any;
    }
  };

  // Apply validations based on column index (1-based)
  // Item Type (3)
  if (types.length) setListValidation(3, `=Lists!$A$2:$A$${types.length + 1}`, false);
  // Condition (4)
  setListValidation(4, `=Lists!$C$2:$C$${conditions.length + 1}`, false);
  // Property (5)
  if (propertyCodes.length) setListValidation(5, `=Lists!$B$2:$B$${propertyCodes.length + 1}`, false);
  // Department (6)
  if (departments.length) setListValidation(6, `=Lists!$D$2:$D$${departments.length + 1}`, false);
  // Enable AMC (12)
  setListValidation(12, ['"Yes,No"'], true);

  // Save
  const buf = await book.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

export type ImportResult = {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export async function importAssetsFromFile(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { inserted: 0, skipped: 0, errors: [{ row: 1, message: "No worksheet found" }] };
  }

  // Read header from first row
  const headerRow = ws.getRow(1);
  const fileHeaders: string[] = [];
  const maxCol = ws.columnCount || headerRow.cellCount || 0;
  for (let c = 1; c <= maxCol; c++) {
    const v = headerRow.getCell(c).value;
    fileHeaders[c - 1] = (typeof v === 'string' ? v : (v as any)?.toString?.() || '').trim();
  }

  // Map file columns to internal keys
  const colMap: Record<number, string> = {};
  fileHeaders.forEach((h, idx) => {
    const cleanHeader = h.replace(/\*$/, '').trim().toLowerCase();
    const config = COLUMN_CONFIG.find(c => c.header.toLowerCase() === cleanHeader);
    if (config) {
      colMap[idx + 1] = config.key;
    }
  });

  // Helper to normalize cell values
  const toPlain = (v: any): any => {
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'object') {
      if ('text' in v && typeof (v as any).text === 'string') return (v as any).text;
      if ('result' in v && (v as any).result != null) return (v as any).result;
      if ('richText' in v && Array.isArray((v as any).richText)) return (v as any).richText.map((r: any) => r.text).join('');
      return String(v);
    }
    return typeof v === 'string' ? v : v;
  };

  const rows: Record<string, any>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    // Skip empty rows
    const isEmpty = row.values === undefined || (Array.isArray(row.values) && row.values.slice(1).every((x) => x == null || x === ''));
    if (isEmpty) continue;
    
    const rec: Record<string, any> = {};
    let hasData = false;
    
    for (let c = 1; c <= maxCol; c++) {
      const key = colMap[c];
      if (!key) continue;
      
      let val = toPlain(row.getCell(c).value);
      
      // Special handling for boolean/list fields
      if (key === 'amcEnabled') {
        val = String(val).toLowerCase() === 'yes';
      } else if (key === 'quantity') {
        val = Number(val) || 0;
      }
      
      if (val !== "" && val !== null && val !== undefined) hasData = true;
      rec[key] = val;
    }
    
    if (hasData) rows.push(rec);
  }

  // Build property code/name -> id map (best effort if backend connected)
  let propCodeToId: Record<string, string> = {};
  let propNameToId: Record<string, string> = {};
  if (hasSupabaseEnv) {
    try {
      const properties = await listProperties();
      propCodeToId = Object.fromEntries(properties.map(p => [p.id, p.id]));
      propNameToId = Object.fromEntries(properties.map(p => [p.name, p.id]));
    } catch {
      // ignore and fallback to provided code in property field
    }
  }

  // Seed sequence counters by prefix from existing assets
  const seqByPrefix: Record<string, number> = {};
  const existing = hasSupabaseEnv ? await listAssets().catch(() => [] as Asset[]) : ([] as Asset[]);
  for (const a of existing) {
    const parts = String(a.id);
    // Try to extract numeric tail; prefix is id without the last 4 digits (default)
    const tail = parts.slice(-4);
    const n = Number(tail);
    if (Number.isFinite(n)) {
      const prefix = parts.slice(0, -4);
      seqByPrefix[prefix] = Math.max(seqByPrefix[prefix] || 0, n);
    }
  }

  const typePrefix = (t: string) => {
    const key = (t || "").toLowerCase();
    if (key.startsWith("elec")) return "ET";
    if (key.startsWith("furn")) return "FR";
    if (key.startsWith("mach")) return "MC";
    if (key.startsWith("veh")) return "VH";
    if (key.startsWith("office")) return "OS";
    return (t?.slice(0, 2) || "AS").toUpperCase();
  };

  const nextId = (assetType: string, propertyCode: string) => {
    const prefix = `${typePrefix(assetType)}${propertyCode}`;
    const next = (seqByPrefix[prefix] || 0) + 1;
    seqByPrefix[prefix] = next;
    return `${prefix}${String(next).padStart(4, "0")}`;
  };

  const registerSeqForId = (assetId: string) => {
    if (!assetId) return;
    const match = String(assetId).match(/^(.*?)(\d{1,})$/);
    if (!match) return;
    const prefix = match[1];
    const num = Number(match[2]);
    if (!Number.isFinite(num)) return;
    seqByPrefix[prefix] = Math.max(seqByPrefix[prefix] || 0, num);
  };

  let inserted = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  // Who is importing (for department and property enforcement)
  let currentUser: any = null;
  try {
    const raw = (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user') || localStorage.getItem('auth_user'));
    currentUser = raw ? JSON.parse(raw) : null;
  } catch {}
  const role = String(currentUser?.role || '').toLowerCase();
  let accessibleProps: Set<string> = new Set();
  try {
    accessibleProps = await getAccessiblePropertyIdsForCurrentUser();
  } catch {}
  let allowedDepartmentsLower: Set<string> | null = null;
  if (role !== 'admin') {
    try {
      const depts = await getAccessibleDepartmentsForCurrentUser();
      if (depts && depts.size > 0) {
        allowedDepartmentsLower = new Set(Array.from(depts).map((d) => String(d).toLowerCase()));
      }
    } catch {}
    if (!allowedDepartmentsLower || allowedDepartmentsLower.size === 0) {
      const fallback = String(currentUser?.department || '').trim();
      if (fallback) {
        allowedDepartmentsLower = new Set([fallback.toLowerCase()]);
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // considering header at row 1
  const name = String(r["name"] ?? "").trim();
  const type = String(r["type"] ?? "").trim();
  const property = String(r["property"] ?? "").trim();
  const department = String(r["department"] ?? "").trim();
  const quantityRaw = Number(r["quantity"] ?? NaN);
  const status = String(r["status"] ?? "").trim() || "Active";

    if (!name || !type || !property || !Number.isFinite(quantityRaw) || !department) {
      skipped++;
      errors.push({ row: rowNum, message: "Missing required fields (name, type, property, department, quantity) or invalid quantity" });
      continue;
    }

  const quantityUnits = Math.max(1, Math.floor(quantityRaw));

  // Resolve property code (prefer code, else map from name)
  const propertyCode = propCodeToId[property] ?? propNameToId[property] ?? property;

  // Prefer provided id if present, else auto-generate
  const providedId = String(r["id"] || "").trim();

      const effectiveDept = department || currentUser?.department || '';
      if (role !== 'admin' && allowedDepartmentsLower && allowedDepartmentsLower.size > 0) {
        const key = String(effectiveDept).toLowerCase();
        if (!key || !allowedDepartmentsLower.has(key)) {
          skipped++;
          errors.push({ row: rowNum, message: `You are not allowed to import assets for department ${effectiveDept || '(blank)'}` });
          continue;
        }
      }

      // Enforce property access for non-admin users if we know the allowed set
      if (role !== 'admin' && accessibleProps.size > 0) {
        if (!accessibleProps.has(propertyCode)) {
          skipped++;
          errors.push({ row: rowNum, message: `You are not allowed to import assets for property ${propertyCode}` });
          continue;
        }
      }

      const baseAsset: Omit<Asset, "id"> = {
      name,
      type,
  property: propertyCode,
  property_id: propertyCode,
    department: effectiveDept || null,
      quantity: 1,
  purchaseDate: r["purchaseDate"] ? String(r["purchaseDate"]).slice(0, 10) : null,
  expiryDate: r["expiryDate"] ? String(r["expiryDate"]).slice(0, 10) : null,
      poNumber: r["poNumber"] ? String(r["poNumber"]).trim() : null,
      condition: r["condition"] ? String(r["condition"]).trim() : null,
      status,
      location: r["location"] ? String(r["location"]).trim() : null,
  description: r["description"] ? String(r["description"]).trim() : null,
  serialNumber: r["serialNumber"] ? String(r["serialNumber"]).trim() : null,
  amcEnabled: !!r["amcEnabled"],
  amcStartDate: r["amcStartDate"] ? String(r["amcStartDate"]).slice(0, 10) : null,
  amcEndDate: r["amcEndDate"] ? String(r["amcEndDate"]).slice(0, 10) : null,
    };

    try {
      if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
      // License check accounts for each unit we are about to create
      try {
        const check = await checkLicenseBeforeCreate(propertyCode, quantityUnits);
        if (!check.ok) {
          skipped++;
          errors.push({ row: rowNum, message: check.message || 'License Exceed: upgrade required' });
          continue;
        }
      } catch (e:any) {
        if (/license/i.test(String(e?.message||''))) {
          skipped++; errors.push({ row: rowNum, message: e.message }); continue;
        }
      }
      const unitIds: string[] = [];
      const firstId = providedId || nextId(type, propertyCode);
      unitIds.push(firstId);
      registerSeqForId(firstId);
      while (unitIds.length < quantityUnits) {
        const next = nextId(type, propertyCode);
        unitIds.push(next);
      }
      for (const unitId of unitIds) {
        await createAsset({ ...baseAsset, id: unitId } as Asset);
        inserted++;
      }
    } catch (e: any) {
      skipped++;
      errors.push({ row: rowNum, message: e?.message || "Failed to insert asset" });
    }
  }

  return { inserted, skipped, errors };
}

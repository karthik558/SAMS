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
};

// Template header: omit id so it's generated automatically
const HEADER: (keyof BulkAssetRow)[] = [
  "name",
  "type",
  "property",
  "department",
  "quantity",
  "purchaseDate",
  "expiryDate",
  "poNumber",
  "condition",
  "status",
  "location",
  "description",
  "serialNumber",
];

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
  const statuses = ["Active", "Expiring Soon", "Expired", "Inactive"];
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
  lists.getCell("D1").value = "Statuses";
  statuses.forEach((v, i) => (lists.getCell(i + 2, 4).value = v));
  lists.getCell("E1").value = "Departments";
  departments.forEach((v, i) => (lists.getCell(i + 2, 5).value = v));
  lists.state = "veryHidden";

  // Header
  input.addRow(HEADER as any);
  input.getRow(1).font = { bold: true };
  // Highlight required headers (name, type, property, department, quantity)
  const requiredCols = new Set([1, 2, 3, 4, 5]);
  requiredCols.forEach((colIdx) => {
    const cell = input.getRow(1).getCell(colIdx);
    // Light highlight and note without changing header text (import relies on exact header names)
    (cell as any).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0B3' } };
    try { (cell as any).note = 'Required'; } catch {}
  });

  // Sample row
  input.addRow([
    "Sample Laptop",
  types[0] || "Electronics",
  propertyCodes[0] || "",
  departments[0] || "",
    10,
    "2025-01-15",
    "2027-01-15",
    "PO-1001",
    "Good",
    "Active",
    "Floor 2, IT Room",
    "15\" laptop, 16GB RAM",
    "SN-ABC-12345",
  ]);

  // Column widths matching HEADER order
  const widths = [24, 18, 22, 18, 10, 14, 14, 16, 14, 14, 28, 28, 18];
  input.columns = widths.map((wch) => ({ width: wch } as any));

  // Data validation for rows 2..1000
  const maxRows = 1000;
  const range = (col: number) => ({ start: 2, end: maxRows, col });
  const setListValidation = (col: number, formulae: string, allowBlank = true) => {
    for (let r = 2; r <= maxRows; r++) {
      input.getCell(r, col).dataValidation = {
        type: 'list',
        allowBlank,
        formulae: [formulae],
        showErrorMessage: true,
        error: 'Select a value from the dropdown list',
      } as any;
    }
  };
  // Helper to enforce non-empty custom validation on a column
  const colToA1 = (n: number): string => {
    let s = "";
    let num = n;
    while (num > 0) {
      const rem = (num - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      num = Math.floor((num - 1) / 26);
    }
    return s;
  };
  const setRequiredValidation = (col: number) => {
    for (let r = 2; r <= maxRows; r++) {
      const addr = `${colToA1(col)}${r}`;
      input.getCell(r, col).dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`LEN(TRIM(${addr}))>0`],
        showErrorMessage: true,
        error: 'This field is required',
      } as any;
    }
  };

  // Only apply list validations if we have values; otherwise leave free text
  if (types.length) setListValidation(2, `=Lists!$A$2:$A$${types.length + 1}`, false); // type (required)
  if (propertyCodes.length) setListValidation(3, `=Lists!$B$2:$B$${propertyCodes.length + 1}`, false); // property code (required)
  if (departments.length) setListValidation(4, `=Lists!$E$2:$E$${departments.length + 1}`, false); // department (required)
  setListValidation(9, `=Lists!$C$2:$C$${conditions.length + 1}`); // condition (optional)
  setListValidation(10, `=Lists!$D$2:$D$${statuses.length + 1}`); // status (optional)
  // Additional non-empty checks for name (1) and quantity (5)
  setRequiredValidation(1); // name
  setRequiredValidation(5); // quantity

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
  const headers: string[] = [];
  const maxCol = ws.columnCount || headerRow.cellCount || 0;
  for (let c = 1; c <= maxCol; c++) {
    const v = headerRow.getCell(c).value;
    headers[c - 1] = (typeof v === 'string' ? v : (v as any)?.toString?.() || '').trim();
  }

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
    for (let c = 1; c <= maxCol; c++) {
      const key = headers[c - 1];
      if (!key) continue;
      rec[key] = toPlain(row.getCell(c).value);
    }
    rows.push(rec);
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
  const quantity = Number(r["quantity"] ?? NaN);
  const status = String(r["status"] ?? "").trim() || "Active";

    if (!name || !type || !property || !Number.isFinite(quantity) || !department) {
      skipped++;
      errors.push({ row: rowNum, message: "Missing required fields (name, type, property, department, quantity) or invalid quantity" });
      continue;
    }

  // Resolve property code (prefer code, else map from name)
  const propertyCode = propCodeToId[property] ?? propNameToId[property] ?? property;

  // Prefer provided id if present, else auto-generate
  const providedId = String(r["id"] || "").trim();
  const id = providedId || nextId(type, propertyCode);

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

      const asset: Asset = {
      id,
      name,
      type,
  property: propertyCode,
  property_id: propertyCode,
    department: effectiveDept || null,
      quantity,
  purchaseDate: r["purchaseDate"] ? String(r["purchaseDate"]).slice(0, 10) : null,
  expiryDate: r["expiryDate"] ? String(r["expiryDate"]).slice(0, 10) : null,
      poNumber: r["poNumber"] ? String(r["poNumber"]).trim() : null,
      condition: r["condition"] ? String(r["condition"]).trim() : null,
      status,
      location: r["location"] ? String(r["location"]).trim() : null,
  description: r["description"] ? String(r["description"]).trim() : null,
  serialNumber: r["serialNumber"] ? String(r["serialNumber"]).trim() : null,
    };

    try {
      if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
      // License check (each row counts as 1 asset regardless of quantity in import template; quantity can represent units but creation is per row)
      try {
        const check = await checkLicenseBeforeCreate(propertyCode, 1);
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
      await createAsset(asset);
      inserted++;
    } catch (e: any) {
      skipped++;
      errors.push({ row: rowNum, message: e?.message || "Failed to insert asset" });
    }
  }

  return { inserted, skipped, errors };
}

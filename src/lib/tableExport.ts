export type ExportRow = Record<string, string | number | boolean | null | undefined>;

function columnsOf(rows: ExportRow[]) {
  const keys: string[] = [];
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!keys.includes(key)) keys.push(key);
    });
  });
  return keys;
}

function escapeCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: ExportRow[]) {
  const keys = columnsOf(rows);
  const lines = [
    keys.join(","),
    ...rows.map((row) => keys.map((key) => escapeCell(row[key])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function tableHtml(title: string, rows: ExportRow[]) {
  const keys = columnsOf(rows);
  const head = keys.map((key) => `<th>${key}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${keys.map((key) => `<td>${row[key] == null ? "" : String(row[key])}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;color:#111;margin:24px}
      h1{font-size:18px;margin:0 0 12px}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border-bottom:1px solid #e5e7eb;text-align:left;padding:8px;vertical-align:top}
      th{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280}
    </style></head><body><h1>${title}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function openPrintFrame(title: string, rows: ExportRow[]) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  doc?.open();
  doc?.write(tableHtml(title, rows));
  doc?.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 200);
}

export function printRows(title: string, rows: ExportRow[]) {
  if (!rows.length) return;
  openPrintFrame(title, rows);
}

export function downloadSimplePdf(title: string, rows: ExportRow[]) {
  if (!rows.length) return;
  openPrintFrame(title, rows);
}

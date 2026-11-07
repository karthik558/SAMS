export type WhatsNewItem = {
  id: string;
  date: string;
  title: string;
  body: string;
};

export const WHATS_NEW: WhatsNewItem[] = [
  {
    id: "2026-11-scan-history",
    date: "Nov 2026",
    title: "Scan history stays with this tab",
    body: "Codes you scan are kept for this session so you can copy or export them before you leave.",
  },
  {
    id: "2026-11-compare",
    date: "Nov 2026",
    title: "Compare and duplicate assets",
    body: "Select two catalogue rows to compare them, or duplicate one into a new asset form.",
  },
  {
    id: "2026-11-labels",
    date: "Nov 2026",
    title: "Label preview before print",
    body: "Choose the label size, copies, and which fields sit under the QR code, then print from the browser.",
  },
];

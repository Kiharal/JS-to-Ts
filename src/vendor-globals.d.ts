/* Ambient types for the scripts the page loads from CDNs (see <script> tags in template.html / loadScriptOnce()).
   Chart.js uses its real published types (devDependency pinned to the same 4.4.1 the page loads);
   jsPDF / autoTable / SheetJS are declared minimally - only the calls this app actually makes. */

declare const Chart: typeof import('chart.js').Chart;

/** The only thing the app does with a stored chart is destroy it before redrawing. */
interface Destroyable { destroy(): void }

type PdfTextOptions = { align?: 'left' | 'center' | 'right' };
interface AutoTableOptions {
  startY?: number;
  head?: string[][];
  body?: (string | number)[][];
  theme?: string;
  styles?: { fontSize?: number; cellPadding?: number };
  headStyles?: { fillColor?: number[]; textColor?: number[] };
  margin?: { left?: number; right?: number };
  columnStyles?: Record<number, { cellWidth?: number | 'auto' | 'wrap'; halign?: string }>;
}
interface JsPdfDocument {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  lastAutoTable: { finalY: number };
  text(text: string | string[], x: number, y: number, options?: PdfTextOptions): JsPdfDocument;
  setFontSize(size: number): JsPdfDocument;
  setTextColor(r: number, g?: number, b?: number): JsPdfDocument;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): JsPdfDocument;
  addPage(): JsPdfDocument;
  autoTable(options: AutoTableOptions): JsPdfDocument;
  save(filename: string): void;
}
interface JsPdfNamespace {
  jsPDF: {
    new (options?: { orientation?: string; unit?: string; format?: string }): JsPdfDocument;
    API: { autoTable?: unknown };
  };
}
interface XlsxSheet { readonly __sheet: unique symbol }
interface XlsxWorkbook { readonly __workbook: unique symbol }
interface XlsxNamespace {
  utils: {
    book_new(): XlsxWorkbook;
    aoa_to_sheet(rows: SheetRow[]): XlsxSheet;
    book_append_sheet(wb: XlsxWorkbook, sheet: XlsxSheet, name: string): void;
  };
  writeFile(wb: XlsxWorkbook, filename: string): void;
}
interface Window {
  jspdf?: JsPdfNamespace;
  XLSX?: XlsxNamespace;
}

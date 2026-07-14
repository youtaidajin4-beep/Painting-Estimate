/** 全書類共通の印刷余白（@page margin は 0、コンテンツ側で最小余白を確保） */
export const PRINT_SHEET_PADDING = "2mm 3mm 1.5mm 3mm";

export const PRINT_A4_WIDTH = "210mm";
export const PRINT_A4_HEIGHT = "297mm";

export const printPageBase = `@page { margin: 0; }`;

export const PRINT_HINT =
  "印刷設定で「余白: なし（または最小）」「倍率: 100%」「ヘッダーとフッター: オフ」にすると、さらに用紙いっぱいに印刷できます。";

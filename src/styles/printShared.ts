/** 全書類共通の印刷余白（@page margin は 0、コンテンツ側で最小余白を確保） */
export const PRINT_SHEET_PADDING = "5mm 4mm";

export const printPageBase = `@page { margin: 0; }`;

export const PRINT_HINT =
  "URLや日付が出る場合は、印刷設定の「ヘッダーとフッター」をオフにしてください。";

declare module 'pdf-parse' {
  export default function pdfParse(dataBuffer: Buffer, options?: any): Promise<{text: string}>;
}

declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer } | { path: string }): Promise<{ value: string; messages: any[] }>;
}

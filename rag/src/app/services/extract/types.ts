export interface DocumentMetadata {
  source: string;
  page: number;
}

export interface ParsedDocument {
  page_content: string;
  metadata: DocumentMetadata;
}

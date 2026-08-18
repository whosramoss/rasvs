import type { RetrievedDocument } from "./types.js";

const SPECIAL_TOKEN_PATTERNS = [
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|endoftext\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<\/SYS>>/gi,
];

const INSTRUCTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi,
  /you\s+are\s+now\s+/gi,
  /new\s+system\s+prompt/gi,
];

export function sanitizeRetrievedText(text: string): string {
  let sanitized = text.replace(/\u0000/g, "");
  sanitized = sanitized.replace(/<\/?untrusted_retrieved_document\b[^>]*>/gi, "");

  for (const pattern of SPECIAL_TOKEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  sanitized = sanitized.replace(
    /^\s*(system|assistant|developer|user)\s*:\s*/gim,
    "[filtered-role]: "
  );

  for (const pattern of INSTRUCTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[filtered-instruction]");
  }

  return sanitized;
}

function escapeAttribute(value: string): string {
  return value.replace(/["<>]/g, "'");
}

export function formatRetrievedDocumentsForLlm(docs: RetrievedDocument[]): string {
  return docs
    .map((doc, index) => {
      const source = escapeAttribute(String(doc.metadata.source ?? "N/A"));
      const page = escapeAttribute(String(doc.metadata.page ?? "N/A"));
      const content = sanitizeRetrievedText(doc.pageContent);
      return (
        `<untrusted_retrieved_document index="${index + 1}" source="${source}" page="${page}">\n` +
        `${content}\n` +
        `</untrusted_retrieved_document>`
      );
    })
    .join("\n\n");
}

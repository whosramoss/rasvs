import type { DocumentChunk } from "./types.js";

export interface TextSplitter {
  splitDocuments(documents: DocumentChunk[]): DocumentChunk[];
}

export class RecursiveCharacterTextSplitter implements TextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options: { chunkSize?: number; chunkOverlap?: number } = {}) {
    this.chunkSize = options.chunkSize ?? 1000;
    this.chunkOverlap = options.chunkOverlap ?? 200;
    this.separators = ["\n\n", "\n", " ", ""];
  }

  splitDocuments(documents: DocumentChunk[]): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const textChunks = this.splitText(doc.pageContent);
      for (const chunk of textChunks) {
        chunks.push({
          pageContent: chunk,
          metadata: { ...doc.metadata },
        });
      }
    }

    return chunks;
  }

  private splitText(text: string): string[] {
    return this.splitTextRecursive(text, this.separators);
  }

  private splitTextRecursive(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];
    let separator = separators[separators.length - 1];
    let newSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      if (sep === "") {
        separator = sep;
        break;
      }
      if (text.includes(sep)) {
        separator = sep;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = separator ? text.split(separator) : Array.from(text);
    let goodSplits: string[] = [];
    const mergeSeparator = separator === "" ? "" : separator;

    for (const split of splits) {
      if (split.length < this.chunkSize) {
        goodSplits.push(split);
      } else {
        if (goodSplits.length > 0) {
          const mergedText = this.mergeSplits(goodSplits, mergeSeparator);
          finalChunks.push(...mergedText);
          goodSplits = [];
        }
        if (newSeparators.length === 0) {
          finalChunks.push(split);
        } else {
          const otherChunks = this.splitTextRecursive(split, newSeparators);
          finalChunks.push(...otherChunks);
        }
      }
    }

    if (goodSplits.length > 0) {
      const mergedText = this.mergeSplits(goodSplits, mergeSeparator);
      finalChunks.push(...mergedText);
    }

    return finalChunks;
  }

  private mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;

    for (const split of splits) {
      const len = split.length;
      if (total + len + (currentDoc.length > 0 ? separator.length : 0) > this.chunkSize) {
        if (currentDoc.length > 0) {
          const doc = currentDoc.join(separator);
          if (doc.trim().length > 0) {
            docs.push(doc);
          }
          while (
            total > this.chunkOverlap ||
            (total + len + (currentDoc.length > 0 ? separator.length : 0) > this.chunkSize &&
              total > 0)
          ) {
            if (currentDoc.length === 0) break;
            const removed = currentDoc.shift();
            total -= (removed?.length ?? 0) + (currentDoc.length > 0 ? separator.length : 0);
          }
        }
      }
      currentDoc.push(split);
      total += len + (currentDoc.length > 1 ? separator.length : 0);
    }

    if (currentDoc.length > 0) {
      const doc = currentDoc.join(separator);
      if (doc.trim().length > 0) {
        docs.push(doc);
      }
    }

    return docs;
  }
}

export class SemanticChunker implements TextSplitter {
  private breakpointThreshold: number;

  constructor(options: { breakpointThreshold?: number } = {}) {
    this.breakpointThreshold = options.breakpointThreshold ?? 0.5;
  }

  splitDocuments(documents: DocumentChunk[]): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const sentences = this.splitIntoSentences(doc.pageContent);
      const semanticChunks = this.groupSentences(sentences);

      for (const chunk of semanticChunks) {
        if (chunk.trim().length > 0) {
          chunks.push({
            pageContent: chunk,
            metadata: { ...doc.metadata },
          });
        }
      }
    }

    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    const sentenceEnders = /(?<=[.!?])\s+/;
    return text.split(sentenceEnders).filter((s) => s.trim().length > 0);
  }

  private groupSentences(sentences: string[]): string[] {
    if (sentences.length === 0) return [];
    if (sentences.length === 1) return sentences;

    const chunks: string[] = [];
    let currentChunk: string[] = [];

    for (const sentence of sentences) {
      currentChunk.push(sentence);

      if (this.shouldBreak(currentChunk)) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }

    return chunks;
  }

  private shouldBreak(sentences: string[]): boolean {
    const totalLength = sentences.reduce((sum, s) => sum + s.length, 0);
    return totalLength > 500;
  }
}

export function createTextSplitter(
  method: string,
  options: { chunkSize?: number; chunkOverlap?: number } = {}
): TextSplitter {
  if (method === "semantic") {
    return new SemanticChunker();
  }
  return new RecursiveCharacterTextSplitter(options);
}

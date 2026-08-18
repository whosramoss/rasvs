import pdfParse from "pdf-parse";
import { logger } from "../../utils/index.js";
import {
  directoryExists,
  listFilesByExtension,
  readBinaryFile,
  resolveFilePath,
  writeJsonFile,
} from "../../utils/index.js";
import { TableOfContentsHeuristic } from "./toc_heuristic.js";
import type { ParsedDocument } from "./types.js";

export class PDFDocumentExtractor {
  private readonly tocDetector: TableOfContentsHeuristic;

  constructor(tocDetector?: TableOfContentsHeuristic) {
    this.tocDetector = tocDetector ?? new TableOfContentsHeuristic();
  }

  async extractDirectoryToJson(
    dataDirectory: string,
    outputJsonPath: string
  ): Promise<ParsedDocument[]> {
    const allPagesData: ParsedDocument[] = [];
    logger.info("Starting document extraction with pdf-parse...");

    if (!directoryExists(dataDirectory)) {
      logger.error("PDF directory does not exist: %s", dataDirectory);
      return [];
    }

    const pdfFiles = listFilesByExtension(dataDirectory, ".pdf");

    for (const filename of pdfFiles) {
      const filePath = resolveFilePath(dataDirectory, filename);
      const pages = await this.extractPdfPages(filePath, filename);
      allPagesData.push(...pages);
    }

    logger.info(
      "Extraction finished. Total valid pages saved: %s.",
      allPagesData.length
    );

    writeJsonFile(outputJsonPath, allPagesData);
    logger.info("Extracted data written to '%s'", outputJsonPath);

    return allPagesData;
  }

  private async extractPdfPages(
    filePath: string,
    filename: string
  ): Promise<ParsedDocument[]> {
    const pages: ParsedDocument[] = [];

    try {
      const dataBuffer = readBinaryFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const textPages = this.splitIntoPages(pdfData.text);

      logger.info("Processing file '%s' with %s page(s).", filename, textPages.length);

      for (let i = 0; i < textPages.length; i++) {
        const pageContent = textPages[i];
        const pageNumber = i + 1;

        if (this.tocDetector.isTableOfContentsPage(pageContent)) {
          logger.warn(
            "Skipping page %s of '%s' (likely table of contents).",
            pageNumber,
            filename
          );
          continue;
        }

        pages.push({
          page_content: pageContent,
          metadata: {
            source: filename,
            page: pageNumber,
          },
        });
      }
    } catch (err) {
      logger.error("Failed to process PDF '%s': %s", filename, err);
    }

    return pages;
  }

  private splitIntoPages(text: string): string[] {
    const pageMarker = /\f/;
    const pages = text.split(pageMarker).filter((p) => p.trim().length > 0);
    if (pages.length === 0 && text.trim().length > 0) {
      return [text];
    }
    return pages;
  }
}

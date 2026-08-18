import { setupLogging, ProjectLayout } from "../../utils/index.js";
import { PDFDocumentExtractor } from "./pdf_extractor.js";

export { PDFDocumentExtractor } from "./pdf_extractor.js";
export { TableOfContentsHeuristic } from "./toc_heuristic.js";
export type { DocumentMetadata, ParsedDocument } from "./types.js";

export async function runExtractCli(): Promise<void> {
  setupLogging();
  const config = ProjectLayout.loadConfiguration();
  const extractor = new PDFDocumentExtractor();
  await extractor.extractDirectoryToJson(config.data_path, config.parsed_data_path);
}

import { config as dotenvConfig } from "dotenv";
import {
  setupLogging,
  logger,
  ProjectLayout,
  fileExists,
  readMilvusSettingsFromEnv,
  milvusCollectionNameFromEnv,
} from "../../utils/index.js";
import { VectorIngestionOrchestrator } from "./vector_ingestion_orchestrator.js";

dotenvConfig();

export { MilvusChunkWriter } from "./milvus_chunk_writer.js";
export { VectorIngestionOrchestrator } from "./vector_ingestion_orchestrator.js";

export async function runIngestCli(): Promise<void> {
  setupLogging();
  const config = ProjectLayout.loadConfiguration();

  const { address: milvusUri, database: milvusDb } = readMilvusSettingsFromEnv();
  const milvusCollection = milvusCollectionNameFromEnv();

  if (!fileExists(config.parsed_data_path)) {
    logger.error(
      "File '%s' not found. Run first: npm run extract",
      config.parsed_data_path
    );
    process.exit(1);
  }

  const orchestrator = new VectorIngestionOrchestrator();
  const docs = orchestrator.loadDocumentsFromJson(config.parsed_data_path);

  for (const strategy of config.ingestion_strategies) {
    const sid = strategy.id;
    logger.info("\n%s PROCESSING STRATEGY %s %s", "=".repeat(20), sid, "=".repeat(20));
    await orchestrator.processStrategy(docs, strategy, milvusUri, milvusDb, milvusCollection);
  }
}

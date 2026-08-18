import {
  logger,
  ProjectLayout,
  createTextSplitter,
  readJsonFile,
  createAuthenticatedMilvusClient,
} from "../../utils/index.js";
import type { IngestionStrategy, DocumentChunk } from "../../utils/index.js";
import { MilvusChunkWriter } from "./milvus_chunk_writer.js";

export class VectorIngestionOrchestrator {
  private writer: MilvusChunkWriter;

  constructor(chunkWriter?: MilvusChunkWriter) {
    this.writer = chunkWriter ?? new MilvusChunkWriter();
  }

  loadDocumentsFromJson(jsonPath: string): DocumentChunk[] {
    logger.info("Loading documents from '%s'...", jsonPath);

    const data = readJsonFile<
      Array<{
        page_content: string;
        metadata: { source: string; page: number };
      }>
    >(jsonPath);

    const documents: DocumentChunk[] = data.map((item) => ({
      pageContent: item.page_content,
      metadata: item.metadata,
    }));

    logger.info("Loaded %s document(s).", documents.length);
    return documents;
  }

  async processStrategy(
    documents: DocumentChunk[],
    strategy: IngestionStrategy,
    milvusUri: string,
    milvusDb: string,
    collectionName: string
  ): Promise<void> {
    const chunkMethod = strategy.chunk_method ?? "recursive";
    const embeddingModelName = strategy.embedding_model;
    const partitionName = strategy.partition_name;
    const resolvedModel = ProjectLayout.resolveModelPathIfLocal(embeddingModelName);

    logger.info(
      "\n--- Processing: chunk_method=%s, model='%s', partition='%s' ---",
      chunkMethod,
      resolvedModel,
      partitionName
    );

    const splitter = createTextSplitter(chunkMethod, {
      chunkSize: strategy.chunk_size,
      chunkOverlap: strategy.chunk_overlap,
    });
    const chunks = splitter.splitDocuments(documents);
    logger.info("Total chunks: %s", chunks.length);

    const client = createAuthenticatedMilvusClient({
      address: milvusUri,
      database: milvusDb,
    });

    try {
      logger.info("Connected to Milvus at '%s', database '%s'.", milvusUri, milvusDb);

      const hasCollection = await client.hasCollection({ collection_name: collectionName });
      if (!hasCollection.value) {
        logger.error(
          "Collection '%s' was not found in Milvus. Create it first.",
          collectionName
        );
        return;
      }

      const hasPartition = await client.hasPartition({
        collection_name: collectionName,
        partition_name: partitionName,
      });

      if (hasPartition.value) {
        logger.warn("Partition '%s' already exists. Dropping old data...", partitionName);
        await client.dropPartition({
          collection_name: collectionName,
          partition_name: partitionName,
        });
      }

      logger.info("Creating partition '%s'", partitionName);
      await client.createPartition({
        collection_name: collectionName,
        partition_name: partitionName,
      });

      await client.loadCollection({ collection_name: collectionName });

      await this.writer.insertChunks(
        client,
        collectionName,
        chunks,
        resolvedModel,
        partitionName
      );
    } catch (err) {
      logger.error("Error while talking to Milvus: %s", err);
    } finally {
      await client.closeConnection();
      logger.info("Milvus connection closed.");
    }
  }
}

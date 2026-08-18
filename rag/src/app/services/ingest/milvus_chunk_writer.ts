import { MilvusClient, RowData } from "@zilliz/milvus2-sdk-node";
import { logger, generateEmbeddings } from "../../utils/index.js";
import type { DocumentChunk } from "../../utils/index.js";

export class MilvusChunkWriter {
  async insertChunks(
    client: MilvusClient,
    collectionName: string,
    chunks: DocumentChunk[],
    embeddingModelName: string,
    partitionName: string
  ): Promise<void> {
    logger.info(
      "Inserting %s chunk(s) into partition '%s'...",
      chunks.length,
      partitionName
    );

    const texts = chunks.map((chunk) => chunk.pageContent);

    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(texts, embeddingModelName);
      logger.info("Embeddings generated successfully.");
    } catch (err) {
      logger.error("Failed to generate embeddings: %s", err);
      return;
    }

    const entities: RowData[] = chunks.map((chunk, i) => ({
      embedding: embeddings[i],
      chunk_text: chunk.pageContent,
      source: chunk.metadata.source ?? "N/A",
      page: chunk.metadata.page ?? 0,
    }));

    try {
      await client.insert({
        collection_name: collectionName,
        partition_name: partitionName,
        data: entities,
      });
      await client.flush({ collection_names: [collectionName] });
      logger.info(
        "%s chunk(s) inserted into partition '%s'.",
        entities.length,
        partitionName
      );
    } catch (err) {
      logger.error("Failed to insert data into Milvus: %s", err);
    }
  }
}

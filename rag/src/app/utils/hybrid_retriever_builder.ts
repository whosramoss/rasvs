import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { config as dotenvConfig } from "dotenv";
import { logger } from "./logging_configuration.js";
import {
  createAuthenticatedMilvusClient,
  milvusCollectionNameFromEnv,
  readMilvusSettingsFromEnv,
} from "./milvus_client_factory.js";
import { ProjectLayout, RetrieverModelsConfig } from "./project_paths.js";
import { generateSingleEmbedding } from "./embedding_service.js";
import { fileExists } from "./file_system.js";
import { BM25Retriever } from "./bm25_retriever.js";
import type { RetrievedDocument, Retriever } from "./types.js";

dotenvConfig();

class MilvusPartitionMaterializer {
  async fetchAllDocuments(
    client: MilvusClient,
    collectionName: string,
    partitionName: string
  ): Promise<RetrievedDocument[]> {
    logger.info(
      "Loading all documents from partition '%s' for BM25...",
      partitionName
    );

    await client.loadPartitions({
      collection_name: collectionName,
      partition_names: [partitionName],
    });

    const result = await client.query({
      collection_name: collectionName,
      partition_names: [partitionName],
      output_fields: ["chunk_text", "source", "page"],
      limit: 16384,
    });

    const docs: RetrievedDocument[] = result.data.map((hit) => ({
      pageContent: hit.chunk_text as string,
      metadata: {
        source: hit.source as string,
        page: hit.page as number,
      },
    }));

    logger.info(
      "%s document(s) loaded from partition '%s' for BM25.",
      docs.length,
      partitionName
    );

    return docs;
  }
}

class MilvusRetriever implements Retriever {
  private client: MilvusClient;
  private collectionName: string;
  private embeddingModelName: string;
  private k: number;

  constructor(
    client: MilvusClient,
    collectionName: string,
    embeddingModelName: string,
    k: number
  ) {
    this.client = client;
    this.collectionName = collectionName;
    this.embeddingModelName = embeddingModelName;
    this.k = k;
  }

  async invoke(query: string): Promise<RetrievedDocument[]> {
    const embedding = await generateSingleEmbedding(query, this.embeddingModelName);

    const results = await this.client.search({
      collection_name: this.collectionName,
      data: [embedding],
      limit: this.k,
      output_fields: ["chunk_text", "source", "page"],
    });

    return results.results.map((hit) => ({
      pageContent: hit.chunk_text as string,
      metadata: {
        source: hit.source as string,
        page: hit.page as number,
      },
    }));
  }
}

class EnsembleRetriever implements Retriever {
  private retrievers: Retriever[];
  private weights: number[];
  private k: number;

  constructor(retrievers: Retriever[], weights: number[], k: number) {
    this.retrievers = retrievers;
    this.weights = weights;
    this.k = k;
  }

  async invoke(query: string): Promise<RetrievedDocument[]> {
    const allResults: Map<string, { doc: RetrievedDocument; score: number }> = new Map();

    for (let i = 0; i < this.retrievers.length; i++) {
      const retriever = this.retrievers[i];
      const weight = this.weights[i];
      const docs = await retriever.invoke(query);

      for (let rank = 0; rank < docs.length; rank++) {
        const doc = docs[rank];
        const key = `${doc.metadata.source}:${doc.metadata.page}:${doc.pageContent.substring(0, 100)}`;
        const rrfScore = weight / (rank + 60);

        const existing = allResults.get(key);
        if (existing) {
          existing.score += rrfScore;
        } else {
          allResults.set(key, { doc, score: rrfScore });
        }
      }
    }

    const sorted = Array.from(allResults.values()).sort((a, b) => b.score - a.score);
    return sorted.slice(0, this.k).map((item) => item.doc);
  }
}

class BM25RetrieverAdapter implements Retriever {
  private bm25: BM25Retriever;

  constructor(bm25: BM25Retriever) {
    this.bm25 = bm25;
  }

  async invoke(query: string): Promise<RetrievedDocument[]> {
    return this.bm25.invoke(query);
  }
}

export class HybridRetrieverBuilder {
  private materializer: MilvusPartitionMaterializer;
  private milvusClient: MilvusClient | null = null;

  constructor(materializer?: MilvusPartitionMaterializer) {
    this.materializer = materializer ?? new MilvusPartitionMaterializer();
  }

  async build(
    partitionName: string,
    embeddingModelName: string,
    kValue: number,
    retrieverConfig: RetrieverModelsConfig
  ): Promise<Retriever> {
    logger.info("Building hybrid retriever for partition '%s'...", partitionName);

    const resolvedModel = this.loadEmbeddingModel(embeddingModelName, retrieverConfig);

    const { address, database } = readMilvusSettingsFromEnv();
    const collectionName = milvusCollectionNameFromEnv();

    this.milvusClient = createAuthenticatedMilvusClient({ address, database });
    logger.info("Connected to Milvus at '%s'.", address);

    const hasCollection = await this.milvusClient.hasCollection({
      collection_name: collectionName,
    });

    if (!hasCollection.value) {
      throw new Error(
        `Collection '${collectionName}' does not exist in Milvus. Run: npm run ingest`
      );
    }

    const milvusRetriever = new MilvusRetriever(
      this.milvusClient,
      collectionName,
      resolvedModel,
      15
    );
    logger.info("Milvus (semantic) retriever created.");

    await this.milvusClient.loadCollection({ collection_name: collectionName });
    const allChunks = await this.materializer.fetchAllDocuments(
      this.milvusClient,
      collectionName,
      partitionName
    );

    if (allChunks.length === 0) {
      throw new Error("No documents found in Milvus to initialize BM25.");
    }

    const bm25 = BM25Retriever.fromDocuments(allChunks, { k: 15 });
    const bm25Adapter = new BM25RetrieverAdapter(bm25);
    logger.info("BM25 (keyword) retriever created.");

    const ensembleRetriever = new EnsembleRetriever(
      [bm25Adapter, milvusRetriever],
      [0.25, 0.75],
      kValue
    );

    logger.info("Hybrid retriever ready (Milvus + BM25).");
    return ensembleRetriever;
  }

  private loadEmbeddingModel(
    embeddingModelName: string,
    retrieverConfig: RetrieverModelsConfig
  ): string {
    const fallbackModel = retrieverConfig.default_embedding_fallback ?? "all-MiniLM-L6-v2";
    const resolvedName = ProjectLayout.resolveModelPathIfLocal(embeddingModelName);

    if (ProjectLayout.isLocalPath(embeddingModelName)) {
      if (!fileExists(resolvedName)) {
        logger.warn(
          "Embedding model '%s' not found. Using fallback '%s'.",
          embeddingModelName,
          fallbackModel
        );
        return fallbackModel;
      }
    }

    return resolvedName;
  }

  async close(): Promise<void> {
    if (this.milvusClient) {
      await this.milvusClient.closeConnection();
    }
  }
}

export async function createAdvancedRetriever(
  partitionName: string,
  embeddingModelName: string,
  kValue: number,
  retrieverConfig: RetrieverModelsConfig
): Promise<Retriever> {
  const builder = new HybridRetrieverBuilder();
  return builder.build(partitionName, embeddingModelName, kValue, retrieverConfig);
}

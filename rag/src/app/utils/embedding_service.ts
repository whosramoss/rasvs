import { pipeline, Pipeline } from "@xenova/transformers";
import { logger } from "./logging_configuration.js";
import { ProjectLayout } from "./project_paths.js";

let embeddingPipeline: Pipeline | null = null;
let currentModelName: string | null = null;

export async function loadEmbeddingModel(modelName: string): Promise<Pipeline> {
  const resolvedModel = ProjectLayout.resolveModelPathIfLocal(modelName);

  if (embeddingPipeline && currentModelName === resolvedModel) {
    return embeddingPipeline;
  }

  logger.info("Loading embedding model: '%s'", resolvedModel);

  try {
    embeddingPipeline = await pipeline("feature-extraction", resolvedModel, {
      quantized: false,
    });
    currentModelName = resolvedModel;
    logger.info("Embedding model loaded successfully.");
    return embeddingPipeline;
  } catch (err) {
    logger.error("Failed to load embedding model '%s': %s", resolvedModel, err);
    throw err;
  }
}

export async function generateEmbeddings(
  texts: string[],
  modelName: string
): Promise<number[][]> {
  const model = await loadEmbeddingModel(modelName);
  const embeddings: number[][] = [];

  logger.info("Generating embeddings for %s text(s)...", texts.length);

  for (const text of texts) {
    try {
      const output = await model(text, { pooling: "mean", normalize: true });
      const embedding = Array.from(output.data as Float32Array);
      embeddings.push(embedding);
    } catch (err) {
      logger.error("Failed to generate embedding for text: %s", err);
      throw err;
    }
  }

  logger.info("Embeddings generated successfully.");
  return embeddings;
}

export async function generateSingleEmbedding(
  text: string,
  modelName: string
): Promise<number[]> {
  const model = await loadEmbeddingModel(modelName);

  try {
    const output = await model(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  } catch (err) {
    logger.error("Failed to generate single embedding: %s", err);
    throw err;
  }
}

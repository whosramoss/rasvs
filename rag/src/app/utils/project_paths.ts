import { readFileSync, existsSync } from "fs";
import { dirname, resolve, isAbsolute, sep } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATH_KEYS = new Set([
  "data_path",
  "parsed_data_path",
  "test_set_path",
  "train_set_path",
  "validation_set_path",
  "results_path",
  "embeddings_output_dir",
]);

export interface IngestionStrategy {
  id: number;
  partition_name: string;
  chunk_method?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  embedding_model: string;
}

export interface EvaluatorConfig {
  llm_judge: string;
  retriever_k: number;
}

export interface AgentConfig {
  strategy_to_use: number;
  partition_to_use: string;
  agent_llm: string;
  retriever_k: number;
}

export interface RetrieverModelsConfig {
  default_embedding_fallback: string;
  reranker_model: string;
}

export interface ProjectConfiguration {
  data_path: string;
  parsed_data_path: string;
  test_set_path: string;
  train_set_path: string;
  validation_set_path: string;
  results_path: string;
  embeddings_output_dir: string;
  ingestion_strategies: IngestionStrategy[];
  evaluator: EvaluatorConfig;
  agent: AgentConfig;
  retriever_models: RetrieverModelsConfig;
}

export class ProjectLayout {
  static srcDirectory(): string {
    return resolve(__dirname, "..", "..");
  }

  static ragDirectory(): string {
    return resolve(this.srcDirectory(), "..");
  }

  static repositoryRoot(): string {
    return resolve(this.ragDirectory(), "..");
  }

  static rootDirectory(): string {
    return this.repositoryRoot();
  }

  static configurationPath(): string {
    return resolve(this.ragDirectory(), "config.yaml");
  }

  static loadConfiguration(): ProjectConfiguration {
    const cfgFile = this.configurationPath();
    if (!existsSync(cfgFile)) {
      throw new Error(
        `Configuration file not found: ${cfgFile}. Expected rag/config.yaml next to src/index.ts.`,
      );
    }

    const fileContents = readFileSync(cfgFile, "utf-8");
    const config = yaml.load(fileContents) as Record<string, unknown>;

    const srcRoot = this.srcDirectory();
    for (const key of PATH_KEYS) {
      if (key in config && config[key]) {
        config[key] = resolve(srcRoot, String(config[key]));
      }
    }

    return config as unknown as ProjectConfiguration;
  }

  static resolveRepositoryPath(relative: string): string {
    return resolve(this.repositoryRoot(), relative);
  }

  static resolveModelPathIfLocal(modelName: string): string {
    if (isAbsolute(modelName)) {
      return modelName;
    }
    const candidate = resolve(this.repositoryRoot(), modelName);
    if (existsSync(candidate)) {
      return candidate;
    }
    return modelName;
  }

  static isLocalPath(modelName: string): boolean {
    return modelName.includes(sep) || modelName.includes("/");
  }
}

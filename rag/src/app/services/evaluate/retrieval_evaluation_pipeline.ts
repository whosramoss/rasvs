import { logger, writeCsvFile } from "../../utils/index.js";
import type { ProjectConfiguration, EvaluationResult } from "../../utils/index.js";
import { RetrievalStrategyBenchmark } from "./retrieval_strategy_benchmark.js";

export class RetrievalEvaluationPipeline {
  private benchmark: RetrievalStrategyBenchmark;

  constructor(benchmark?: RetrievalStrategyBenchmark) {
    this.benchmark = benchmark ?? new RetrievalStrategyBenchmark();
  }

  async runFromConfig(config: ProjectConfiguration): Promise<EvaluationResult[]> {
    const allResults: EvaluationResult[] = [];

    for (const strategy of config.ingestion_strategies) {
      const strategyId = strategy.id;
      const partitionName = strategy.partition_name;

      let accuracy: number;
      try {
        accuracy = await this.benchmark.runSingleStrategy(
          config.test_set_path,
          strategy.embedding_model,
          config.evaluator.retriever_k,
          config.evaluator.llm_judge,
          config.retriever_models,
          partitionName
        );
      } catch (evalErr) {
        logger.error("Error evaluating strategy %s: %s", strategyId, evalErr);
        accuracy = 0;
      }

      const chunkSize = strategy.chunk_size ?? "N/A";

      allResults.push({
        strategy_id: strategyId,
        chunk_size: chunkSize,
        embedding_model: strategy.embedding_model,
        accuracy: `${accuracy.toFixed(2)}%`,
      });
    }

    return allResults;
  }

  persistResults(results: EvaluationResult[], resultsPath: string): void {
    const columns = ["strategy_id", "chunk_size", "embedding_model", "accuracy"];
    writeCsvFile(resultsPath, results, columns);
    logger.info("Evaluation results saved to: %s", resultsPath);
  }
}

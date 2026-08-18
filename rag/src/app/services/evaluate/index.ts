import { config as dotenvConfig } from "dotenv";
import { setupLogging, ProjectLayout } from "../../utils/index.js";
import { LangChainTracingGuard } from "./langchain_tracing_guard.js";
import { RetrievalEvaluationPipeline } from "./retrieval_evaluation_pipeline.js";

dotenvConfig();

export { LangChainTracingGuard } from "./langchain_tracing_guard.js";
export { LLMRelevanceJudge } from "./llm_relevance_judge.js";
export { RetrievalStrategyBenchmark } from "./retrieval_strategy_benchmark.js";
export { RetrievalEvaluationPipeline } from "./retrieval_evaluation_pipeline.js";

export async function runEvaluateCli(): Promise<void> {
  LangChainTracingGuard.disableLangSmithTracing();
  setupLogging();
  const config = ProjectLayout.loadConfiguration();
  const pipeline = new RetrievalEvaluationPipeline();
  const resultsDf = await pipeline.runFromConfig(config);
  pipeline.persistResults(resultsDf, config.results_path);
}

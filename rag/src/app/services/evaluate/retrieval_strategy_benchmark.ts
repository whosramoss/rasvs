import { logger, HybridRetrieverBuilder, readCsvFile } from "../../utils/index.js";
import type { RetrievedDocument, Retriever } from "../../utils/index.js";
import { LLMRelevanceJudge } from "./llm_relevance_judge.js";

interface TestSetRow {
  question: string;
}

export class RetrievalStrategyBenchmark {
  private judge: LLMRelevanceJudge;
  private builder: HybridRetrieverBuilder;

  constructor(
    judge?: LLMRelevanceJudge,
    retrieverBuilder?: HybridRetrieverBuilder
  ) {
    this.judge = judge ?? new LLMRelevanceJudge();
    this.builder = retrieverBuilder ?? new HybridRetrieverBuilder();
  }

  async runSingleStrategy(
    testSetPath: string,
    embeddingModelName: string,
    retrieverK: number,
    judgeModelName: string,
    retrieverConfig: { default_embedding_fallback: string; reranker_model: string },
    partitionName: string
  ): Promise<number> {
    logger.info(
      "\n--- Evaluating strategy with embedding: %s, partition: %s ---",
      embeddingModelName,
      partitionName
    );

    const testDf = readCsvFile<TestSetRow>(testSetPath);

    let advancedRetriever: Retriever;
    try {
      advancedRetriever = await this.builder.build(
        partitionName,
        embeddingModelName,
        retrieverK,
        retrieverConfig
      );
    } catch (err) {
      logger.error("Failed to build retriever: %s", err);
      throw err;
    }

    let correctHits = 0;

    for (const row of testDf) {
      const question = row.question;

      let topPassages: RetrievedDocument[] = [];
      try {
        topPassages = await advancedRetriever.invoke(question);
      } catch (invErr) {
        logger.error(
          "Failed to retrieve passages for question '%s': %s",
          question,
          invErr
        );
      }

      const judgement = await this.judge.judge(question, topPassages, judgeModelName);

      if (judgement.isRelevant) {
        correctHits++;
      }

      logger.info(
        "Question: %s... | Relevant: %s",
        question.substring(0, 50),
        judgement.isRelevant
      );
    }

    const accuracy = testDf.length > 0 ? (correctHits / testDf.length) * 100 : 0;

    logger.info(
      "--- Final result for '%s' (hybrid search + re-ranker) ---",
      embeddingModelName
    );
    logger.info(
      "Retrieval accuracy: %.2f%% (%s/%s)",
      accuracy.toFixed(2),
      correctHits,
      testDf.length
    );

    return accuracy;
  }
}

"""
Retrieval quality evaluation (LLM-as-Judge) on a tabular test set.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from langchain.prompts import PromptTemplate
from langchain.schema.output_parser import StrOutputParser
from langchain_openai import ChatOpenAI

from app.hybrid_retriever_builder import HybridRetrieverBuilder
from app.logging_configuration import setup_logging
from app.project_paths import ProjectLayout

load_dotenv()


class LangChainTracingGuard:
    """Disable LangSmith tracing when related env vars are set."""

    @staticmethod
    def disable_langsmith_tracing() -> None:
        try:
            del os.environ["LANGCHAIN_TRACING_V2"]
            del os.environ["LANGCHAIN_API_KEY"]
            print("--- LangSmith tracing disabled from code. ---")
        except KeyError:
            pass


class LLMRelevanceJudge:
    """Use an LLM to estimate whether retrieved context answers the question."""

    def judge(
        self, question: str, retrieved_chunks: list, judge_model_name: str
    ) -> dict:
        context = "\n---\n".join([chunk.page_content for chunk in retrieved_chunks])

        prompt_template = """
    Your task is to judge whether the provided Context Documents contain an answer to the User Question.
    Be strict: the context must answer the question directly. Mentioning keywords alone is not enough.

    Example:
    User Question: "What are the five phases of The OWASP Testing Framework?"
    Context Documents: "The OWASP Testing Guide is an important resource for security. It includes a testing framework."
    Judgment: false (The context mentions the framework but does not list the five phases.)

    ---
    User Question: "{question}"

    Retrieved Context Documents:
    ---
    {context}
    ---

    Based on your analysis, is the context relevant and sufficient to answer the question?
    Reply with ONLY "true" or "false".
    """

        prompt = PromptTemplate.from_template(prompt_template)
        try:
            llm = ChatOpenAI(model=judge_model_name, temperature=0)
            chain = prompt | llm | StrOutputParser()
            response = chain.invoke(
                {
                    "question": question,
                    "context": context,
                }
            )
            print(
                "================================ JUDGE OUTPUT ================================"
            )
            print(f"[?] QUESTION: {question}")
            print(f"[i] CONTEXT:\n{context}")
            print(f"[*] RAW JUDGE RESPONSE: {response}")
            print(
                "=============================================================================="
            )
            is_relevant = "true" in response.lower()
            return {"is_relevant": is_relevant, "raw_response": response}
        except Exception as judge_err:
            logging.warning(
                "LLM judge unavailable: %s. Using simple relevance heuristic.",
                judge_err,
            )
            question_terms = [t.lower() for t in question.split() if len(t) > 3]
            is_relevant = False
            for chunk in retrieved_chunks:
                content_lower = chunk.page_content.lower()
                if all(term in content_lower for term in question_terms):
                    is_relevant = True
                    break
            return {
                "is_relevant": is_relevant,
                "raw_response": "fallback_heuristic",
            }


class RetrievalStrategyBenchmark:
    """Run the hybrid retriever on each CSV question and aggregate accuracy."""

    def __init__(
        self,
        judge: LLMRelevanceJudge | None = None,
        retriever_builder: HybridRetrieverBuilder | None = None,
    ) -> None:
        self._judge = judge or LLMRelevanceJudge()
        self._builder = retriever_builder or HybridRetrieverBuilder()

    def run_single_strategy(
        self,
        test_set_path: str,
        embedding_model_name: str,
        retriever_k: int,
        judge_model_name: str,
        retriever_config: dict,
        partition_name: str,
    ) -> float:
        logging.info(
            "\n--- Evaluating strategy with embedding: %s, partition: %s ---",
            embedding_model_name,
            partition_name,
        )
        test_df = pd.read_csv(test_set_path)

        advanced_retriever = self._builder.build(
            partition_name=partition_name,
            embedding_model_name=embedding_model_name,
            k_value=retriever_k,
            retriever_config=retriever_config,
        )

        correct_hits = 0

        for _, row in test_df.iterrows():
            question = row["question"]

            try:
                top_passages = advanced_retriever.invoke(question)
            except Exception as inv_err:
                logging.error(
                    "Failed to retrieve passages for question '%s': %s",
                    question,
                    inv_err,
                )
                top_passages = []

            judgement = self._judge.judge(question, top_passages, judge_model_name)

            if judgement["is_relevant"]:
                correct_hits += 1

            logging.info(
                "Question: %s... | Relevant: %s",
                question[:50],
                judgement["is_relevant"],
            )

        if len(test_df) > 0:
            accuracy = (correct_hits / len(test_df)) * 100
        else:
            accuracy = 0.0

        logging.info(
            "--- Final result for '%s' (hybrid search + re-ranker) ---",
            embedding_model_name,
        )
        logging.info(
            "Retrieval accuracy: %.2f%% (%s/%s)",
            accuracy,
            correct_hits,
            len(test_df),
        )
        return accuracy


class RetrievalEvaluationPipeline:
    """Iterate ingestion strategies from YAML and write an aggregated results CSV."""

    def __init__(self, benchmark: RetrievalStrategyBenchmark | None = None) -> None:
        self._benchmark = benchmark or RetrievalStrategyBenchmark()

    def run_from_config(self, config: dict) -> pd.DataFrame:
        all_results = []
        for strategy in config["ingestion_strategies"]:
            strategy_id = strategy["id"]
            partition_name = strategy["partition_name"]

            try:
                accuracy = self._benchmark.run_single_strategy(
                    test_set_path=config["test_set_path"],
                    embedding_model_name=strategy["embedding_model"],
                    retriever_k=config["evaluator"]["retriever_k"],
                    judge_model_name=config["evaluator"]["llm_judge"],
                    retriever_config=config["retriever_models"],
                    partition_name=partition_name,
                )
            except Exception as eval_err:
                logging.error(
                    "Error evaluating strategy %s: %s", strategy_id, eval_err
                )
                accuracy = 0.0

            chunk_size = strategy.get("chunk_size", "N/A")

            all_results.append(
                {
                    "strategy_id": strategy_id,
                    "chunk_size": chunk_size,
                    "embedding_model": strategy["embedding_model"],
                    "accuracy": f"{accuracy:.2f}%",
                }
            )

        return pd.DataFrame(all_results)

    def persist_results(self, df: pd.DataFrame, results_path: str) -> None:
        path = Path(results_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(path, index=False)
        logging.info("Evaluation results saved to: %s", path)


def run_evaluate_cli() -> None:
    """Run LLM-as-Judge evaluation and write the results CSV."""
    LangChainTracingGuard.disable_langsmith_tracing()
    setup_logging()
    config = ProjectLayout.load_configuration()
    pipeline = RetrievalEvaluationPipeline()
    results_df = pipeline.run_from_config(config)
    pipeline.persist_results(results_df, config["results_path"])

"""
Conversational RAG agent (LangChain) with a search tool over the indexed corpus.
"""
from __future__ import annotations

import logging
from typing import Any

from dotenv import load_dotenv
from langchain.agents import AgentExecutor, create_openai_tools_agent, tool
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.hybrid_retriever_builder import HybridRetrieverBuilder
from app.logging_configuration import setup_logging
from app.project_paths import ProjectLayout

load_dotenv()


class ConversationalRAGOrchestrator:
    """
    Resolve ingestion strategy, build the hybrid retriever, and expose an ``AgentExecutor``.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        self._config = config
        self._chosen_strategy = self._resolve_strategy(
            config["agent"]["strategy_to_use"]
        )
        self._retriever = self._bootstrap_retriever()

    def _resolve_strategy(self, strategy_id: int) -> dict[str, Any]:
        chosen = next(
            (s for s in self._config["ingestion_strategies"] if s["id"] == strategy_id),
            None,
        )
        if not chosen:
            raise ValueError(
                f"Strategy id '{strategy_id}' not found in config.yaml"
            )
        logging.info("Agent will use strategy id %s", chosen["id"])
        return chosen

    def _bootstrap_retriever(self):
        builder = HybridRetrieverBuilder()
        try:
            return builder.build(
                partition_name=self._chosen_strategy["partition_name"],
                embedding_model_name=self._chosen_strategy["embedding_model"],
                k_value=self._config["agent"]["retriever_k"],
                retriever_config=self._config["retriever_models"],
            )
        except Exception as retr_err:
            logging.error(
                "Failed to create retriever for the agent: %s", retr_err
            )
            return None

    def _make_search_tool(self):
        retriever = self._retriever

        @tool
        def search_in_documents(search_query: str) -> str:
            """
            Semantic search over OWASP ASVS to find requirements and guidance on
            application and web service security. Input should be a clear question or keywords.
            """

            logging.info(
                "--- Agent tool invoked with query: '%s' ---",
                search_query,
            )

            if retriever is None:
                return (
                    "Search is unavailable. Ensure the vector index exists "
                    "(run python rag/main.py ingest) and that dependencies are installed."
                )

            docs = retriever.invoke(search_query)
            if not docs:
                return (
                    "No relevant information was found in the documents for this query."
                )

            return "\n\n---\n\n".join(
                [
                    f"Source: {doc.metadata.get('source', 'N/A')}, "
                    f"Page: {doc.metadata.get('page', 'N/A')}\n"
                    f"Content: {doc.page_content}"
                    for doc in docs
                ]
            )

        return search_in_documents

    def build_agent_executor(self) -> AgentExecutor:
        tools = [self._make_search_tool()]

        system_prompt = """
    You are an assistant focused on web application security analysis, named RASVS.
    Your tone is analytical, precise, and concise.

    Follow these rules strictly:

    1. Reasoning (chain of thought): Before answering, think step by step. First, break the
    user question into keywords or sub-questions. Second, call search_in_documents for each
    sub-question. Third, synthesize the retrieved snippets into one coherent answer.

    2. Tool use: Always use search_in_documents to obtain context. Do not rely on prior
    knowledge alone. If the first search returns nothing, reformulate the query to be more
    specific or broader as appropriate.

    3. Answer format: The final answer MUST follow this structure:

    - Direct answer: Answer the question clearly.
    - Evidence: Quote the exact passages that support your answer.
    - Sources: List sources as (File: [file_name], Page: [page_number]).

    4. Uncertainty: If the documents are insufficient, state clearly: Based on the
    provided documents, a complete answer could not be found for this question.
    """

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", system_prompt),
                ("user", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ]
        )

        llm = ChatOpenAI(
            model=self._config["agent"]["agent_llm"],
            temperature=0,
        )

        agent = create_openai_tools_agent(llm, tools, prompt)
        return AgentExecutor(agent=agent, tools=tools, verbose=True)


class RAGInteractiveCLI:
    """Simple terminal loop driving the ``AgentExecutor``."""

    def __init__(self, executor: AgentExecutor) -> None:
        self._executor = executor

    def run_forever(self) -> None:
        logging.info(
            "RAG agent started. Type your questions. Press Ctrl+C to exit."
        )
        try:
            while True:
                question = input("\nYour question: ")
                response = self._executor.invoke({"input": question})
                logging.info("\n--- Agent reply ---")
                logging.info(response["output"])
        except KeyboardInterrupt:
            logging.info("\n\nExiting agent. Goodbye.")


def run_agent_cli() -> None:
    """Start the interactive RAG agent loop."""
    setup_logging()
    configuration = ProjectLayout.load_configuration()
    orchestrator = ConversationalRAGOrchestrator(configuration)
    agent_executor = orchestrator.build_agent_executor()
    RAGInteractiveCLI(agent_executor).run_forever()

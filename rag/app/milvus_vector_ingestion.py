"""
Chunked document ingestion and embeddings into a Milvus collection.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_experimental.text_splitter import SemanticChunker
from langchain_core.documents import Document
from pymilvus import Collection, connections, utility

from app.logging_configuration import setup_logging
from app.project_paths import ProjectLayout

load_dotenv()


class MilvusChunkWriter:
    """Build embeddings and insert rows into a Milvus collection/partition."""

    def insert_chunks(
        self,
        collection: Collection,
        chunks: list[Document],
        embedding_model: HuggingFaceEmbeddings,
        partition_name: str,
    ) -> None:
        logging.info(
            "Inserting %s chunk(s) into partition '%s'...",
            len(chunks),
            partition_name,
        )

        texts = [chunk.page_content for chunk in chunks]
        try:
            embeddings = embedding_model.embed_documents(texts)
            logging.info("Embeddings generated successfully.")
        except Exception as e:
            logging.error("Failed to generate embeddings: %s", e)
            return

        entities: list[dict[str, Any]] = []
        for i, chunk in enumerate(chunks):
            entities.append(
                {
                    "embedding": embeddings[i],
                    "chunk_text": chunk.page_content,
                    "source": chunk.metadata.get("source", "N/A"),
                    "page": int(chunk.metadata.get("page", 0)),
                }
            )

        try:
            collection.insert(entities, partition_name=partition_name)
            collection.flush()
            logging.info(
                "%s chunk(s) inserted into partition '%s'.",
                len(entities),
                partition_name,
            )
        except Exception as e:
            logging.error("Failed to insert data into Milvus: %s", e)


class VectorIngestionOrchestrator:
    """
    Orchestrates chunking (recursive or semantic), embeddings, and Milvus load
    for each strategy in ``config.yaml``.
    """

    def __init__(self, chunk_writer: MilvusChunkWriter | None = None) -> None:
        self._writer = chunk_writer or MilvusChunkWriter()

    def load_documents_from_json(self, json_path: str | Path) -> list[Document]:
        path = Path(json_path)
        if not path.is_file():
            raise FileNotFoundError(str(path))

        logging.info("Loading documents from '%s'...", path)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        documents = [
            Document(page_content=item["page_content"], metadata=item["metadata"])
            for item in data
        ]
        logging.info("Loaded %s document(s).", len(documents))
        return documents

    def build_text_splitter(
        self,
        strategy: dict[str, Any],
        embedding_model: HuggingFaceEmbeddings,
    ):
        chunk_method = strategy.get("chunk_method", "recursive")
        if chunk_method == "semantic":
            return SemanticChunker(embedding_model)

        chunk_size = strategy.get("chunk_size", 1000)
        chunk_overlap = strategy.get("chunk_overlap", 200)
        return RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    def process_strategy(
        self,
        documents: list[Document],
        strategy: dict[str, Any],
        milvus_uri: str | None,
        milvus_db: str | None,
        collection_name: str | None,
    ) -> None:
        chunk_method = strategy.get("chunk_method", "recursive")
        embedding_model_name = strategy["embedding_model"]
        partition_name = strategy["partition_name"]

        resolved_model = ProjectLayout.resolve_model_path_if_local(
            embedding_model_name
        )

        logging.info(
            "\n--- Processing: chunk_method=%s, model='%s', partition='%s' ---",
            chunk_method,
            resolved_model,
            partition_name,
        )

        embedding_model = HuggingFaceEmbeddings(model_name=resolved_model)
        splitter = self.build_text_splitter(strategy, embedding_model)
        chunks = splitter.split_documents(documents)
        logging.info("Total chunks: %s", len(chunks))

        try:
            connections.connect(alias="default", uri=milvus_uri, db_name=milvus_db)
            logging.info(
                "Connected to Milvus at '%s', database '%s'.",
                milvus_uri,
                milvus_db,
            )

            if not utility.has_collection(collection_name):
                logging.error(
                    "Collection '%s' was not found in Milvus. Create it first.",
                    collection_name,
                )
                return

            collection = Collection(name=collection_name)

            if collection.has_partition(partition_name):
                logging.warning(
                    "Partition '%s' already exists. Dropping old data...",
                    partition_name,
                )
                collection.drop_partition(partition_name)

            logging.info("Creating partition '%s'", partition_name)
            collection.create_partition(partition_name)
            collection.load()

            self._writer.insert_chunks(
                collection, chunks, embedding_model, partition_name
            )

        except Exception as e:
            logging.error("Error while talking to Milvus: %s", e)
        finally:
            connections.disconnect(alias="default")
            logging.info("Milvus connection closed.")


def run_ingest_cli() -> None:
    """Load parsed JSON and run every ingestion strategy against Milvus."""
    setup_logging()
    config = ProjectLayout.load_configuration()

    milvus_uri = os.getenv("MILVUS_AMB_URI")
    milvus_collection = os.getenv("MILVUS_COLLECTION_NAME")
    milvus_db = os.getenv("MILVUS_DB_NAME")

    json_path = config["parsed_data_path"]
    if not os.path.exists(json_path):
        logging.error(
            "File '%s' not found. Run first: python rag/main.py extract",
            json_path,
        )
        sys.exit(1)

    orchestrator = VectorIngestionOrchestrator()
    docs = orchestrator.load_documents_from_json(json_path)

    for strategy in config["ingestion_strategies"]:
        sid = strategy["id"]
        logging.info("\n%s PROCESSING STRATEGY %s %s", "=" * 20, sid, "=" * 20)
        orchestrator.process_strategy(
            documents=docs,
            strategy=strategy,
            milvus_uri=milvus_uri,
            milvus_db=milvus_db,
            collection_name=milvus_collection,
        )

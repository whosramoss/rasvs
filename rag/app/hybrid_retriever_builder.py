"""
Hybrid retriever (Milvus + BM25) with Cross-Encoder re-ranking.
"""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from langchain.retrievers import (
    ContextualCompressionRetriever,
    EnsembleRetriever,
)
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from langchain_milvus.vectorstores import Milvus
from langchain.schema.retriever import BaseRetriever
from pymilvus import Collection, connections, utility

from app.project_paths import ProjectLayout

load_dotenv()

try:
    from langchain_community.cross_encoders import HuggingFaceCrossEncoder
except Exception as e:
    HuggingFaceCrossEncoder = None
    logging.warning(
        "Could not import HuggingFaceCrossEncoder; re-ranking disabled. Error: %s",
        e,
    )


class MilvusPartitionMaterializer:
    """Load all chunk texts from a Milvus partition as LangChain ``Document`` rows (BM25 input)."""

    def fetch_all_documents(
        self, collection: Collection, partition_name: str
    ) -> list[Document]:
        logging.info(
            "Loading all documents from partition '%s' for BM25...",
            partition_name,
        )

        collection.load([partition_name])

        res = collection.query(
            expr="",
            output_fields=["chunk_text", "source", "page"],
            partition_names=[partition_name],
            limit=16384,
        )

        docs: list[Document] = []
        for hit in res:
            docs.append(
                Document(
                    page_content=hit["chunk_text"],
                    metadata={"source": hit["source"], "page": hit["page"]},
                )
            )

        logging.info(
            "%s document(s) loaded from partition '%s' for BM25.",
            len(docs),
            partition_name,
        )
        return docs


class HybridRetrieverBuilder:
    """
    Build an ensemble retriever (BM25 + Milvus) and optional Cross-Encoder compression.
    """

    def __init__(
        self,
        materializer: MilvusPartitionMaterializer | None = None,
    ) -> None:
        self._materializer = materializer or MilvusPartitionMaterializer()

    def _load_embedding_model(
        self, embedding_model_name: str, retriever_config: dict
    ) -> HuggingFaceEmbeddings:
        fallback_model = retriever_config.get(
            "default_embedding_fallback", "all-MiniLM-L6-v2"
        )
        resolved_name = ProjectLayout.resolve_model_path_if_local(embedding_model_name)
        use_name = resolved_name
        if os.path.sep in embedding_model_name and not os.path.exists(use_name):
            logging.warning(
                "Embedding model '%s' not found. Using fallback '%s'.",
                embedding_model_name,
                fallback_model,
            )
            use_name = fallback_model

        try:
            return HuggingFaceEmbeddings(model_name=use_name)
        except Exception as embed_err:
            logging.error(
                "Failed to load embeddings '%s': %s. Using fallback '%s'.",
                use_name,
                embed_err,
                fallback_model,
            )
            return HuggingFaceEmbeddings(model_name=fallback_model)

    def build(
        self,
        partition_name: str,
        embedding_model_name: str,
        k_value: int,
        retriever_config: dict,
    ) -> BaseRetriever:
        logging.info(
            "Building hybrid retriever for partition '%s'...",
            partition_name,
        )

        embedding_model = self._load_embedding_model(
            embedding_model_name, retriever_config
        )

        uri = os.getenv("MILVUS_AMB_URI")
        db_name = os.getenv("MILVUS_DB_NAME")
        collection_name = os.getenv("MILVUS_COLLECTION_NAME")

        try:
            connections.connect(alias="default", uri=uri, db_name=db_name)
            logging.info("Connected to Milvus at '%s'.", uri)

            if not utility.has_collection(collection_name):
                raise FileNotFoundError(
                    f"Collection '{collection_name}' does not exist in Milvus. "
                    "Run: python rag/main.py ingest"
                )

            milvus_retriever = Milvus(
                embedding_function=embedding_model,
                collection_name=collection_name,
                connection_args={"alias": "default"},
                auto_id=True,
                text_field="chunk_text",
                vector_field="embedding",
            ).as_retriever(search_kwargs={"k": 15})

            logging.info("Milvus (semantic) retriever created.")

            milvus_collection = Collection(name=collection_name)
            milvus_collection.load()
            all_chunks = self._materializer.fetch_all_documents(
                milvus_collection, partition_name
            )

            if not all_chunks:
                raise ValueError(
                    "No documents found in Milvus to initialize BM25."
                )

            bm25_retriever = BM25Retriever.from_documents(all_chunks)
            bm25_retriever.k = 15
            logging.info("BM25 (keyword) retriever created.")

        except Exception as e:
            logging.error("Failed to connect or configure Milvus retrievers: %s", e)
            raise

        ensemble_retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, milvus_retriever],
            weights=[0.25, 0.75],
        )

        if HuggingFaceCrossEncoder is None:
            logging.warning("Returning hybrid retriever without re-ranking.")
            return ensemble_retriever

        try:
            reranker_model_name = retriever_config.get("reranker_model")
            logging.info("Loading re-ranker model: '%s'", reranker_model_name)

            re_ranker_model = HuggingFaceCrossEncoder(model_name=reranker_model_name)
            compressor = CrossEncoderReranker(model=re_ranker_model, top_n=k_value)

            compression_retriever = ContextualCompressionRetriever(
                base_compressor=compressor,
                base_retriever=ensemble_retriever,
            )
            logging.info(
                "Hybrid retriever ready (Milvus + BM25 + Cross-Encoder re-ranker)."
            )
            return compression_retriever

        except Exception as rerank_err:
            logging.warning(
                "Failed to configure re-ranker: %s. Returning hybrid retriever only.",
                rerank_err,
            )
            return ensemble_retriever


def create_advanced_retriever(
    partition_name: str,
    embedding_model_name: str,
    k_value: int,
    retriever_config: dict,
) -> BaseRetriever:
    """Functional facade for legacy call sites."""
    return HybridRetrieverBuilder().build(
        partition_name=partition_name,
        embedding_model_name=embedding_model_name,
        k_value=k_value,
        retriever_config=retriever_config,
    )

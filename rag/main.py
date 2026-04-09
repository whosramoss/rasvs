#!/usr/bin/env python3

from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path


class Rasvs:

    # subcommand → (help, module, function)
    COMMANDS: dict[str, tuple[str, str, str]] = {
        "extract": (
            "Extract text from PDFs → JSON under rag/output/parsed",
            "app.pdf_document_extractor",
            "run_extract_cli",
        ),
        "ingest": (
            "Read JSON, build chunks/embeddings, and write to Milvus",
            "app.milvus_vector_ingestion",
            "run_ingest_cli",
        ),
        "evaluate": (
            "Evaluate the retriever with LLM-as-Judge (datasets under rag/input/datasets)",
            "app.retrieval_evaluation_pipeline",
            "run_evaluate_cli",
        ),
        "agent": (
            "Conversational agent (interactive CLI)",
            "app.conversational_rag_agent",
            "run_agent_cli",
        ),
    }

    @staticmethod
    def _ensure_rasvs_on_path() -> None:
        rag_dir = str(Path(__file__).resolve().parent)
        if rag_dir not in sys.path:
            sys.path.insert(0, rag_dir)

    @classmethod
    def run(cls) -> None:
        cls._ensure_rasvs_on_path()

        parser = argparse.ArgumentParser(
            description=(
                "RAG ASVS — run from rag/ or via `python rag/main.py` from the repo root "
                "(extract, ingest, evaluate, or agent)."
            ),
        )
        sub = parser.add_subparsers(dest="command", required=True)
        for name, (help_text, _, _) in cls.COMMANDS.items():
            sub.add_parser(name, help=help_text)

        args = parser.parse_args()
        _, module_name, func_name = cls.COMMANDS[args.command]
        getattr(importlib.import_module(module_name), func_name)()


def main() -> None:
    Rasvs.run()


if __name__ == "__main__":
    main()

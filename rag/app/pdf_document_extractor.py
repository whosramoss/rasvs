"""
PDF text extraction pipeline to structured JSON (pre-ingestion).
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from langchain_community.document_loaders import PyMuPDFLoader

from app.logging_configuration import setup_logging
from app.project_paths import ProjectLayout


class TableOfContentsHeuristic:
    """Heuristic to detect pages that look like a table of contents."""

    @staticmethod
    def is_table_of_contents_page(page_content: str) -> bool:
        lines_with_dots = 0
        total_lines = 0
        for line in page_content.split("\n"):
            line = line.strip()
            if not line:
                continue
            total_lines += 1
            if ". " in line and line.split(". ")[-1].strip().isdigit():
                lines_with_dots += 1

        if total_lines > 0 and (lines_with_dots / total_lines) > 0.3:
            return True
        return False


class PDFDocumentExtractor:
    """
    Extract pages from all PDFs in a directory, filter likely index pages,
    and persist a list of dicts compatible with vector ingestion.
    """

    def __init__(self, toc_detector: TableOfContentsHeuristic | None = None) -> None:
        self._toc = toc_detector or TableOfContentsHeuristic()

    def extract_directory_to_json(
        self,
        data_directory: str | Path,
        output_json_path: str | Path,
    ) -> list[dict[str, Any]]:
        """
        Read PDFs under ``data_directory`` and write JSON to ``output_json_path``.

        Creates parent directories for the output file when needed.
        """
        data_path = Path(data_directory)
        output_path = Path(output_json_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        all_pages_data: list[dict[str, Any]] = []
        logging.info("Starting document extraction with PyMuPDFLoader...")

        if not data_path.is_dir():
            logging.error("PDF directory does not exist: %s", data_path)
            return []

        for filename in os.listdir(data_path):
            if not filename.lower().endswith(".pdf"):
                continue
            file_path = data_path / filename
            loader = PyMuPDFLoader(str(file_path))
            docs = loader.load()

            logging.info(
                "Processing file '%s' with %s page(s).",
                filename,
                len(docs),
            )

            for doc in docs:
                if self._toc.is_table_of_contents_page(doc.page_content):
                    logging.warning(
                        "Skipping page %s of '%s' (likely table of contents).",
                        doc.metadata.get("page", "N/A"),
                        filename,
                    )
                    continue

                page_data = {
                    "page_content": doc.page_content,
                    "metadata": {
                        "source": filename,
                        "page": doc.metadata.get("page", 0) + 1,
                    },
                }
                all_pages_data.append(page_data)

        logging.info(
            "Extraction finished. Total valid pages saved: %s.",
            len(all_pages_data),
        )

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_pages_data, f, ensure_ascii=False, indent=4)

        logging.info("Extracted data written to '%s'", output_path)
        return all_pages_data


def run_extract_cli() -> None:
    """Extract PDFs according to ``data_path`` in YAML (e.g. rag/input/documents)."""
    setup_logging()
    config = ProjectLayout.load_configuration()
    extractor = PDFDocumentExtractor()
    extractor.extract_directory_to_json(
        data_directory=config["data_path"],
        output_json_path=config["parsed_data_path"],
    )

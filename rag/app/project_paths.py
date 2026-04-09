"""
Path resolution for ``config.yaml`` living under ``rag/``.

``rag/app/project_paths.py`` → ``rag/`` is one level up (contains ``config.yaml``, ``main.py``).
The repository root (parent of ``rag/``) is used for ``local_models/`` and similar.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

_RAG_ROOT_PARENT_LEVEL = 1

_PATH_KEYS = frozenset(
    {
        "data_path",
        "parsed_data_path",
        "test_set_path",
        "train_set_path",
        "validation_set_path",
        "results_path",
        "embeddings_output_dir",
    }
)


class ProjectLayout:
    """Layout: ``rag/``, repo root, config path, and absolute paths from YAML."""

    @staticmethod
    def rag_directory() -> Path:
        """Directory ``rag/`` (contains ``app/``, ``input/``, ``output/``, ``config.yaml``)."""
        return Path(__file__).resolve().parents[_RAG_ROOT_PARENT_LEVEL]

    @staticmethod
    def repository_root() -> Path:
        """Monorepo root (parent of ``rag/``)."""
        return ProjectLayout.rag_directory().parent

    @staticmethod
    def root_directory() -> Path:
        """Alias of repository root (backward-compatible name for model resolution)."""
        return ProjectLayout.repository_root()

    @classmethod
    def configuration_path(cls) -> Path:
        return cls.rag_directory() / "config.yaml"

    @classmethod
    def load_configuration(cls) -> dict[str, Any]:
        """
        Load ``rag/config.yaml`` and resolve ``_PATH_KEYS`` against ``rag/``.

        Raises:
            FileNotFoundError: if ``config.yaml`` is missing.
        """
        cfg_file = cls.configuration_path()
        if not cfg_file.is_file():
            raise FileNotFoundError(
                f"Configuration file not found: {cfg_file}. "
                "Expected rag/config.yaml next to rag/main.py."
            )
        with open(cfg_file, encoding="utf-8") as f:
            config: dict[str, Any] = yaml.safe_load(f)

        rag_root = cls.rag_directory()
        for key in _PATH_KEYS:
            if key in config and config[key]:
                config[key] = str((rag_root / str(config[key])).resolve())
        return config

    @classmethod
    def resolve_repository_path(cls, relative: str) -> Path:
        """Resolve a path relative to the monorepo root."""
        return (cls.repository_root() / relative).resolve()

    @classmethod
    def resolve_model_path_if_local(cls, model_name: str) -> str:
        """
        If ``model_name`` is relative and exists under the monorepo root, return absolute path.
        Otherwise return ``model_name`` (Hugging Face id or already absolute).
        """
        p = Path(model_name)
        if p.is_absolute():
            return model_name
        candidate = cls.repository_root() / model_name
        if candidate.exists():
            return str(candidate.resolve())
        return model_name

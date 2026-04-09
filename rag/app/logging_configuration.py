"""
Centralized logging configuration for the application.
"""
from __future__ import annotations

import logging
import sys
from typing import ClassVar


class ApplicationLogging:
    """Default format and stdout handler for application logs."""

    DEFAULT_FORMAT: ClassVar[str] = "%(asctime)s [%(levelname)s] %(message)s"
    DEFAULT_LEVEL: ClassVar[int] = logging.INFO

    @classmethod
    def configure(cls, level: int | None = None) -> None:
        """
        Apply ``logging.basicConfig`` once (idempotent across repeated calls).

        Args:
            level: Log level; defaults to INFO.
        """
        root = logging.getLogger()
        if root.handlers:
            root.setLevel(level or cls.DEFAULT_LEVEL)
            return
        logging.basicConfig(
            level=level or cls.DEFAULT_LEVEL,
            format=cls.DEFAULT_FORMAT,
            handlers=[logging.StreamHandler(sys.stdout)],
        )


def setup_logging(level: int | None = None) -> None:
    """Compatibility shim that configures application logging."""
    ApplicationLogging.configure(level=level)

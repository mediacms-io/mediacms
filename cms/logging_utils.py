"""
Logging utility functions for structured logging and context management.

This module provides helpers for consistent logging patterns across the application,
including context managers for operation timing and utilities for sanitizing
sensitive data in log messages.
"""

import logging
import time
from contextlib import contextmanager
from functools import wraps


def sanitize_path(path, max_length=100):
    """
    Sanitize file paths for logging by truncating long paths.
    
    Args:
        path: File path to sanitize
        max_length: Maximum length of path to include in logs
        
    Returns:
        Sanitized path string
    """
    if not path:
        return ""
    if len(path) <= max_length:
        return path
    # Truncate from the beginning, keeping the filename
    return "..." + path[-(max_length - 3):]


def sanitize_token(token, visible_chars=4):
    """
    Sanitize tokens/keys for logging by showing only first and last few characters.
    
    Args:
        token: Token to sanitize
        visible_chars: Number of characters to show at start and end
        
    Returns:
        Sanitized token string
    """
    if not token:
        return ""
    if len(token) <= visible_chars * 2:
        return "*" * len(token)
    return token[:visible_chars] + "*" * (len(token) - visible_chars * 2) + token[-visible_chars:]


@contextmanager
def log_operation_timing(logger, operation_name, **context):
    """
    Context manager for logging operation timing and context.
    
    Usage:
        with log_operation_timing(logger, "encode_media", media_id=media.id):
            # operation code
            pass
    
    Args:
        logger: Logger instance
        operation_name: Name of the operation being performed
        **context: Additional context to include in log messages
    """
    start_time = time.time()
    context_str = ", ".join(f"{k}={v}" for k, v in context.items()) if context else ""
    logger.info(f"Starting {operation_name}" + (f" - {context_str}" if context_str else ""))
    
    try:
        yield
        elapsed = time.time() - start_time
        logger.info(f"Completed {operation_name} in {elapsed:.2f}s" + (f" - {context_str}" if context_str else ""))
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Failed {operation_name} after {elapsed:.2f}s" + (f" - {context_str}" if context_str else ""), exc_info=True)
        raise


def log_exception_with_context(logger, message, exc_info=True, **context):
    """
    Log an exception with additional context.
    
    Args:
        logger: Logger instance
        message: Base message to log
        exc_info: Whether to include exception traceback (default True)
        **context: Additional context to include in log message
    """
    context_str = ", ".join(f"{k}={v}" for k, v in context.items()) if context else ""
    full_message = message + (f" - {context_str}" if context_str else "")
    
    if exc_info:
        logger.exception(full_message)
    else:
        logger.error(full_message)


"""
Circuit breaker re-export shim.

All circuit breaker logic has been consolidated into crawler_health.py.
This module re-exports the relevant names so any code that still imports
from circuit_breaker continues to work without modification.
"""

from crawler_health import (  # noqa: F401
    should_skip_crawl as should_skip_source,
    get_all_circuit_states,
    CircuitState,
)

__all__ = ["should_skip_source", "get_all_circuit_states", "CircuitState"]

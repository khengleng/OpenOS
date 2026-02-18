"""
Code execution tool with sandboxing
"""

from langchain_core.tools import tool
from typing import Dict, Any


# Import global state from parent module
def _get_global_state():
    """Get global state from parent module"""
    from livebench.tools.direct_tools import _global_state
    return _global_state


@tool
def execute_code(code: str, language: str = "python") -> Dict[str, Any]:
    """
    Deprecated unsafe local execution path.

    This function is intentionally disabled. Use execute_code_sandbox
    (E2B-based isolated execution) instead.
    """
    return {
        "success": False,
        "error": "Local code execution is disabled for security. Use execute_code_sandbox.",
    }

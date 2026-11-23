"""Expose the life-bucket assistant tools over MCP.

The tools themselves stay synchronous and open their own database sessions.
MCP handlers hop to a worker thread so the API event loop keeps running.
"""

from __future__ import annotations

import asyncio
import inspect
import json
from collections.abc import Awaitable, Callable
from typing import Annotated, Any, get_type_hints

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, Field, create_model
from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined

from app.agent.tools import CLARIFY_TOOLS, READ_TOOLS, WRITE_TOOLS

Runner = Callable[[dict[str, Any]], Awaitable[str]]
TOOLS = [*READ_TOOLS, *WRITE_TOOLS, *CLARIFY_TOOLS]


def _annotation(model: type[BaseModel], name: str, field: FieldInfo) -> Any:
    annotation = field.annotation
    if isinstance(annotation, str):
        annotation = get_type_hints(model, include_extras=True).get(name, Any)
    if annotation is None:
        annotation = Any
    if field.description:
        return Annotated[annotation, Field(description=field.description)]
    return annotation


def _default(field: FieldInfo) -> Any:
    if field.is_required():
        return inspect.Parameter.empty
    if field.default is not PydanticUndefined:
        return field.default
    if field.default_factory is not None:
        return field.default_factory()
    return None


def bind_tool(name: str, description: str, model: type[BaseModel], runner: Runner) -> Callable[..., Awaitable[str]]:
    """Build a function whose signature matches a Pydantic input model."""

    async def call(**kwargs: Any) -> str:
        return await runner(kwargs)

    parameters: list[inspect.Parameter] = []
    annotations: dict[str, Any] = {}
    for field_name, field in model.model_fields.items():
        annotation = _annotation(model, field_name, field)
        parameters.append(
            inspect.Parameter(
                field_name,
                inspect.Parameter.KEYWORD_ONLY,
                default=_default(field),
                annotation=annotation,
            )
        )
        annotations[field_name] = annotation
    annotations["return"] = str
    call.__signature__ = inspect.Signature(parameters, return_annotation=str)  # type: ignore[attr-defined]
    call.__name__ = name
    call.__doc__ = description
    call.__annotations__ = annotations
    return call


def _model_for(tool: Any) -> type[BaseModel]:
    schema = getattr(tool, "args_schema", None)
    if isinstance(schema, type) and issubclass(schema, BaseModel):
        return schema
    return create_model(f"{tool.name}_args")


def _runner(tool: Any) -> Runner:
    async def run(arguments: dict[str, Any]) -> str:
        result = await asyncio.to_thread(tool.invoke, arguments)
        if isinstance(result, str):
            return result
        return json.dumps(result, ensure_ascii=False, default=str)

    return run


def build_mcp() -> FastMCP:
    """Register habit, task, project, bucket, and journal tools on a stateless HTTP MCP server."""
    server = FastMCP(
        "life-bucket",
        instructions=(
            "Tools for habits, tasks, projects, life buckets, and the journal. "
            "Look up ids before a write. If the project, habit, or bucket is not explicit, "
            "call ask_missing_info and stop."
        ),
        host="0.0.0.0",
        streamable_http_path="/",
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    for tool in TOOLS:
        server.add_tool(
            bind_tool(tool.name, tool.description, _model_for(tool), _runner(tool)),
            name=tool.name,
            description=tool.description,
            structured_output=False,
        )
    return server


mcp = build_mcp()

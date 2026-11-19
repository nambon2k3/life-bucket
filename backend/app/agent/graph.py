"""A small tool-calling graph.

    START -> agent -> END
                 |
                 +-> tools -> agent
                          |
                          +-> END   when the coach must ask the user first

`allow_writes=False` drops the mutating tools and ask_missing_info. The weekly
review job uses that mode so a scheduled run can look at the board without
checking habits in, creating tasks, or waiting for an answer.
"""

import json
from functools import lru_cache
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import CLARIFY_TOOLS, READ_TOOLS, WRITE_TOOLS, ask_missing_info, context_snapshot
from app.core.config import get_settings


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


def _message_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "".join(parts)
    return ""


def _call_name(call: object) -> str:
    if isinstance(call, dict):
        return str(call.get("name") or "")
    return str(getattr(call, "name", "") or "")


def _call_id(call: object) -> str:
    if isinstance(call, dict):
        return str(call.get("id") or "")
    return str(getattr(call, "id", "") or "")


def _call_args(call: object) -> dict:
    args = call.get("args") if isinstance(call, dict) else getattr(call, "args", {})
    return args if isinstance(args, dict) else {}


def clarify_reply(content: str) -> str:
    """Turn an ask_missing_info payload into the message the user sees."""

    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return content.strip()
    question = str(payload.get("question") or "What is missing?").strip()
    lines = [question]
    for choice in payload.get("choices") or []:
        if isinstance(choice, dict) and choice.get("id") is not None and choice.get("name"):
            lines.append(f"{choice['id']} — {choice['name']}")
    return "\n".join(lines)


def _tools_node(tools: list):
    runner = ToolNode(tools)

    def run(state: AgentState) -> dict:
        last = state["messages"][-1]
        calls = list(getattr(last, "tool_calls", None) or [])
        if not any(_call_name(call) == "ask_missing_info" for call in calls):
            return runner.invoke(state)
        # A clarifying question ends the turn. Skip writes queued beside it.
        messages: list[ToolMessage] = []
        for call in calls:
            name = _call_name(call)
            if name == "ask_missing_info":
                content = str(ask_missing_info.invoke(_call_args(call)))
            else:
                content = json.dumps({"skipped": True, "reason": "Waiting for the user to answer ask_missing_info"})
            messages.append(ToolMessage(content=content, name=name, tool_call_id=_call_id(call)))
        return {"messages": messages}

    return run


def _after_tools(state: AgentState) -> str:
    for message in reversed(state["messages"]):
        if getattr(message, "type", "") != "tool":
            break
        if getattr(message, "name", "") == "ask_missing_info":
            return END
    return "agent"


@lru_cache
def get_graph(allow_writes: bool):
    settings = get_settings()
    tools = READ_TOOLS + (WRITE_TOOLS + CLARIFY_TOOLS if allow_writes else [])
    model = ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=0.2,
    ).bind_tools(tools)

    def agent_node(state: AgentState) -> dict:
        return {"messages": [model.invoke(state["messages"])]}

    def route(state: AgentState) -> str:
        last = state["messages"][-1]
        if getattr(last, "tool_calls", None):
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", _tools_node(tools))
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", route, {"tools": "tools", END: END})
    graph.add_conditional_edges("tools", _after_tools, {END: END, "agent": "agent"})
    return graph.compile()


def run_agent(messages: list[dict], *, allow_writes: bool) -> dict:
    lc_messages: list[AnyMessage] = [
        SystemMessage(content=SYSTEM_PROMPT),
        SystemMessage(content=f"Snapshot:\n{context_snapshot()}"),
    ]
    for message in messages[-12:]:
        if message["role"] == "assistant":
            lc_messages.append(AIMessage(content=message["content"]))
        else:
            lc_messages.append(HumanMessage(content=message["content"]))

    result = get_graph(allow_writes).invoke({"messages": lc_messages}, config={"recursion_limit": 8})
    reply = ""
    clarification = ""
    tool_trace: list[str] = []
    for message in result["messages"]:
        for call in getattr(message, "tool_calls", None) or []:
            name = call.get("name") if isinstance(call, dict) else getattr(call, "name", "")
            if name:
                tool_trace.append(str(name))
        if getattr(message, "type", "") == "tool" and getattr(message, "name", "") == "ask_missing_info":
            clarification = clarify_reply(_message_text(message.content))
        if getattr(message, "type", "") == "ai":
            text = _message_text(message.content)
            if text.strip():
                reply = text.strip()
    if clarification:
        reply = clarification
    elif not reply:
        reply = "The local model returned no text. Try a model that supports tool calling, such as qwen2.5 or llama3.1."
    return {"reply": reply, "tool_trace": tool_trace}

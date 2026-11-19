"""A small tool-calling graph.

    START -> agent -> END
                 |
                 +-> tools -> agent

`allow_writes=False` drops the mutating tools. The weekly review job uses that
mode so a scheduled run can look at the board without checking habits in by itself.
"""

from functools import lru_cache
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import READ_TOOLS, WRITE_TOOLS, context_snapshot
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


@lru_cache
def get_graph(allow_writes: bool):
    settings = get_settings()
    tools = READ_TOOLS + (WRITE_TOOLS if allow_writes else [])
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
    graph.add_node("tools", ToolNode(tools))
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", route, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
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
    tool_trace: list[str] = []
    for message in result["messages"]:
        for call in getattr(message, "tool_calls", None) or []:
            name = call.get("name") if isinstance(call, dict) else getattr(call, "name", "")
            if name:
                tool_trace.append(str(name))
        if getattr(message, "type", "") == "ai":
            text = _message_text(message.content)
            if text.strip():
                reply = text.strip()
    if not reply:
        reply = "The local model returned no text. Try a model that supports tool calling, such as qwen2.5 or llama3.1."
    return {"reply": reply, "tool_trace": tool_trace}

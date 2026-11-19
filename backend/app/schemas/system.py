from typing import Literal

from pydantic import BaseModel, Field


class ServiceStatus(BaseModel):
    name: str
    ok: bool
    detail: str = ""


class HealthOut(BaseModel):
    ok: bool
    services: list[ServiceStatus]
    ollama_model: str
    ollama_base_url: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)


class ChatResponse(BaseModel):
    reply: str
    tool_trace: list[str]


class JobAccepted(BaseModel):
    task_id: str
    task_name: str


class JobStatus(BaseModel):
    task_id: str
    state: str
    result: dict | list | str | int | None = None
    error: str | None = None

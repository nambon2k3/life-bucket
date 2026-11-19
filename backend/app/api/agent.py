from fastapi import APIRouter, HTTPException

from app.schemas.system import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    from app.agent.graph import run_agent

    try:
        result = run_agent([message.model_dump() for message in payload.messages], allow_writes=True)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Local model is unavailable ({exc.__class__.__name__}). Is Ollama running with the configured model?",
        ) from exc
    return ChatResponse(reply=result["reply"], tool_trace=result["tool_trace"])

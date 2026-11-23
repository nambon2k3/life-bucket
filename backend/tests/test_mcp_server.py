"""The MCP catalogue matches the assistant tools."""

import asyncio

from app.mcp.server import TOOLS, mcp


def test_mcp_lists_life_bucket_tools():
    listed = asyncio.run(mcp.list_tools())
    by_name = {tool.name: tool for tool in listed}

    assert set(by_name) == {tool.name for tool in TOOLS}
    assert "habit_id" in by_name["log_habit_checkin"].inputSchema["properties"]
    assert "title" in by_name["add_task"].inputSchema["properties"]
    assert "title" in by_name["add_journal_entry"].inputSchema["properties"]
    assert "name" in by_name["add_habit"].inputSchema["properties"]
    assert "habit_id" in by_name["delete_habit"].inputSchema["properties"]
    assert "name" in by_name["add_project"].inputSchema["properties"]
    assert "name" in by_name["add_bucket"].inputSchema["properties"]
    assert by_name["list_buckets"].inputSchema.get("properties", {}) == {}
    habits = by_name["list_habits_today"].inputSchema
    assert habits.get("properties", {}) == {}

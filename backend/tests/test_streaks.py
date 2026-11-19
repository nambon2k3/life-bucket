from datetime import date, timedelta

from app.services.streaks import current_streak, longest_streak, week_start_ordinal


def test_daily_streak_includes_today() -> None:
    today = date(2026, 11, 19)
    days = [today, today - timedelta(days=1)]
    assert current_streak(days, today) == 2


def test_daily_streak_survives_until_yesterday() -> None:
    today = date(2026, 11, 19)
    days = [today - timedelta(days=1), today - timedelta(days=2)]
    assert current_streak(days, today) == 2


def test_daily_streak_breaks_after_a_gap() -> None:
    today = date(2026, 11, 19)
    assert current_streak([today - timedelta(days=3)], today) == 0


def test_longest_daily_streak_stops_at_the_gap() -> None:
    today = date(2026, 11, 19)
    days = [today, today - timedelta(days=1), today - timedelta(days=3)]
    assert longest_streak(days) == 2


def test_weekly_streak_crosses_the_new_year() -> None:
    first = date(2025, 12, 29)
    second = date(2026, 1, 5)
    assert week_start_ordinal(second) - week_start_ordinal(first) == 7
    assert current_streak([first, second], date(2026, 1, 6), "weekly") == 2
    assert longest_streak([first, second], "weekly") == 2


def test_empty_checkins_have_no_streak() -> None:
    assert current_streak([], date(2026, 11, 19)) == 0
    assert longest_streak([], "weekly") == 0

from collections.abc import Iterable
from datetime import date


def week_start_ordinal(day: date) -> int:
    """Monday of the ISO week, as an ordinal. Neighboring weeks are 7 apart."""

    iso = day.isocalendar()
    return date.fromisocalendar(iso.year, iso.week, 1).toordinal()


def current_streak(checkin_days: Iterable[date], today: date, frequency: str = "daily") -> int:
    """Count the open run of periods ending today, or yesterday if today is still empty.

    A daily habit checked yesterday but not yet today keeps its streak.
    The streak drops to zero only after a full missed period.
    """

    indexes = _indexes(checkin_days, frequency)
    if not indexes:
        return 0
    step = 7 if frequency == "weekly" else 1
    cursor = _cursor(today, frequency)
    if cursor not in indexes:
        cursor -= step
    streak = 0
    while cursor in indexes:
        streak += 1
        cursor -= step
    return streak


def longest_streak(checkin_days: Iterable[date], frequency: str = "daily") -> int:
    ordered = sorted(_indexes(checkin_days, frequency))
    if not ordered:
        return 0
    step = 7 if frequency == "weekly" else 1
    best = current = 1
    for previous, value in zip(ordered, ordered[1:]):
        if value - previous == step:
            current += 1
            best = max(best, current)
        else:
            current = 1
    return best


def _indexes(checkin_days: Iterable[date], frequency: str) -> set[int]:
    if frequency == "weekly":
        return {week_start_ordinal(day) for day in checkin_days}
    return {day.toordinal() for day in checkin_days}


def _cursor(today: date, frequency: str) -> int:
    if frequency == "weekly":
        return week_start_ordinal(today)
    return today.toordinal()

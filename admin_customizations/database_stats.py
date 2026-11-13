"""Current-database PostgreSQL health counters for the admin Database page."""

from datetime import timedelta

from django.db import connection, transaction

XID_AGE_WARN = 200_000_000
XID_AGE_FAIL = 1_500_000_000
CONNECTION_WARN_PCT = 70
CONNECTION_FAIL_PCT = 90
CACHE_SAMPLE_MIN = 1000
CACHE_WARN_PCT = 99
CACHE_FAIL_PCT = 90
CHECKPOINT_WARN_PCT = 90
REPLICATION_LAG_WARN_SECONDS = 30
REPLICATION_LAG_FAIL_SECONDS = 300


def _row(group, label, value, translate_value=False):
    return {"group": group, "label": label, "value": str(value), "translate_value": translate_value}


def _check(check_id, label, status, detail, **detail_kwargs):
    rendered = detail
    if detail_kwargs:
        try:
            rendered = detail.format(**detail_kwargs)
        except (KeyError, ValueError, IndexError):
            rendered = detail
    return {
        "id": check_id,
        "label": label,
        "status": status,
        "detail": rendered,
        "detail_template": detail,
        "detail_kwargs": detail_kwargs,
        "link": None,
        "group": "database",
    }


def _count_checks(checks):
    return {status: sum(1 for check in checks if check["status"] == status) for status in ("ok", "warn", "fail", "info")}


def _unavailable_payload():
    checks = [_check("database_statistics", "Database statistics", "fail", "Database statistics are unavailable.")]
    return {
        "available": False,
        "status": "unavailable",
        "summary": {
            "connections_used": "Unavailable",
            "cache_hit": "Unavailable",
            "database_size": "Unavailable",
            "xid_age": "Unavailable",
        },
        "rows": [_row("Database", "Database statistics are unavailable", "Unavailable", translate_value=True)],
        "health_checks": checks,
        "health_counts": _count_checks(checks),
    }


def _query(sql):
    """Run one statement. A failure rolls back only that statement."""
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(sql)
                row = cursor.fetchone()
                if row is None:
                    return None
                return {cursor.description[index][0]: row[index] for index in range(len(row))}
    except Exception:
        return None


def _percent(numerator, denominator, digits):
    if not denominator:
        return "n/a"
    return f"{(100.0 * numerator / denominator):.{digits}f}%"


def _format_interval(value):
    if value is None:
        return "n/a"
    if not isinstance(value, timedelta):
        return str(value)
    total = int(value.total_seconds())
    sign = "-" if total < 0 else ""
    total = abs(total)
    days, remainder = divmod(total, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    if days:
        return f"{sign}{days}d {hours}h {minutes}m"
    if hours:
        return f"{sign}{hours}h {minutes}m {seconds}s"
    return f"{sign}{minutes}m {seconds}s"


def _format_reset(value):
    if value is None:
        return "n/a"
    if hasattr(value, "isoformat"):
        return value.isoformat(sep=" ", timespec="seconds")
    return str(value)


def _server_rows():
    row = _query(
        """
        SELECT current_setting('server_version') AS server_version,
               now() - pg_postmaster_start_time() AS uptime,
               pg_size_pretty(pg_database_size(current_database())) AS database_size,
               age(datfrozenxid) AS xid_age
        FROM pg_database
        WHERE datname = current_database()
        """
    )
    if row is None:
        return [_row("Server", "Server", "Unavailable", translate_value=True)], {}
    facts = {
        "server_ok": True,
        "database_size": str(row["database_size"]),
        "xid_age": int(row["xid_age"] or 0),
    }
    rows = [
        _row("Server", "Server version", row["server_version"]),
        _row("Server", "Uptime", _format_interval(row["uptime"]), translate_value=row["uptime"] is None),
        _row("Server", "Database size", facts["database_size"]),
        _row("Server", "Transaction ID age", facts["xid_age"]),
    ]
    return rows, facts


def _connection_rows():
    row = _query(
        """
        SELECT count(*) AS total_connections,
               count(*) FILTER (WHERE state = 'active') AS active,
               count(*) FILTER (WHERE state = 'idle') AS idle,
               count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_xact,
               count(*) FILTER (
                   WHERE state IS DISTINCT FROM 'idle'
                     AND query_start IS NOT NULL
                     AND now() - query_start > interval '5 minutes'
               ) AS long_running,
               (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections
        FROM pg_stat_activity
        WHERE backend_type = 'client backend'
        """
    )
    if row is None:
        return [_row("Connections", "Connections", "Unavailable", translate_value=True)], {}
    total = int(row["total_connections"] or 0)
    maximum = int(row["max_connections"] or 0)
    idle_in_xact = int(row["idle_in_xact"] or 0)
    used = _percent(total, maximum, 1)
    facts = {
        "connections_ok": True,
        "connections_used": used,
        "connections_total": total,
        "connections_max": maximum,
        "connection_pct": None if not maximum else (100.0 * total / maximum),
        "idle_in_xact": idle_in_xact,
        "long_running": int(row["long_running"] or 0),
    }
    rows = [
        _row("Connections", "Connections", total),
        _row("Connections", "Active", int(row["active"] or 0)),
        _row("Connections", "Idle", int(row["idle"] or 0)),
        _row("Connections", "Idle in transaction", idle_in_xact),
        _row("Connections", "Max connections", maximum),
        _row("Connections", "Connections used", used, translate_value=used == "n/a"),
        _row("Connections", "Long-running sessions", int(row["long_running"] or 0)),
    ]
    return rows, facts


def _activity_rows():
    row = _query(
        """
        SELECT numbackends,
               xact_commit,
               xact_rollback,
               deadlocks,
               temp_files,
               pg_size_pretty(temp_bytes) AS temp_size,
               blks_hit,
               blks_read,
               stats_reset
        FROM pg_stat_database
        WHERE datname = current_database()
        """
    )
    if row is None:
        return [_row("Activity", "Activity", "Unavailable", translate_value=True)], {}
    hits = int(row["blks_hit"] or 0)
    reads = int(row["blks_read"] or 0)
    cache_hit = _percent(hits, hits + reads, 2)
    reset = _format_reset(row["stats_reset"])
    facts = {
        "activity_ok": True,
        "cache_hit": cache_hit,
        "cache_blocks": hits + reads,
        "deadlocks": int(row["deadlocks"] or 0),
        "temp_files": int(row["temp_files"] or 0),
        "temp_size": str(row["temp_size"]),
    }
    rows = [
        _row("Activity", "Sessions", int(row["numbackends"] or 0)),
        _row("Activity", "Commits", int(row["xact_commit"] or 0)),
        _row("Activity", "Rollbacks", int(row["xact_rollback"] or 0)),
        _row("Activity", "Deadlocks", int(row["deadlocks"] or 0)),
        _row("Activity", "Temporary files", int(row["temp_files"] or 0)),
        _row("Activity", "Temporary file size", row["temp_size"]),
        _row("Activity", "Cache hit ratio", cache_hit, translate_value=cache_hit == "n/a"),
        _row("Activity", "Blocks hit", hits),
        _row("Activity", "Blocks read", reads),
        _row("Activity", "Statistics reset", reset, translate_value=reset == "n/a"),
    ]
    return rows, facts


def _checkpoint_rows():
    row = _query("SELECT checkpoints_timed, checkpoints_req FROM pg_stat_checkpointer")
    if row is None:
        row = _query("SELECT checkpoints_timed, checkpoints_req FROM pg_stat_bgwriter")
    if row is None:
        return [_row("Checkpoints", "Checkpoints", "Unavailable", translate_value=True)], {}
    timed = int(row["checkpoints_timed"] or 0)
    requested = int(row["checkpoints_req"] or 0)
    timed_pct = _percent(timed, timed + requested, 1)
    facts = {
        "checkpoints_ok": True,
        "checkpoints_timed": timed,
        "checkpoints_requested": requested,
        "checkpoint_pct": None if not timed + requested else (100.0 * timed / (timed + requested)),
        "checkpoint_pct_label": timed_pct,
    }
    rows = [
        _row("Checkpoints", "Checkpoints timed", timed),
        _row("Checkpoints", "Checkpoints requested", requested),
        _row("Checkpoints", "Timed checkpoints", timed_pct, translate_value=timed_pct == "n/a"),
    ]
    return rows, facts


def _replication_rows():
    row = _query("SELECT count(*) AS replicas, max(replay_lag) AS replay_lag FROM pg_stat_replication")
    if row is None:
        return [_row("Replication", "Replication", "Unavailable", translate_value=True)], {}
    replicas = int(row["replicas"] or 0)
    lag_value = row["replay_lag"]
    lag_seconds = lag_value.total_seconds() if isinstance(lag_value, timedelta) else None
    facts = {
        "replication_ok": True,
        "replicas": replicas,
        "replay_lag_seconds": lag_seconds,
        "replay_lag": _format_interval(lag_value),
    }
    if replicas == 0:
        return [_row("Replication", "Replicas", "No replicas", translate_value=True)], facts
    lag = facts["replay_lag"]
    return [
        _row("Replication", "Replicas", replicas),
        _row("Replication", "Replay lag", lag, translate_value=lag == "n/a"),
    ], facts


def _connection_checks(facts):
    if not facts.get("connections_ok"):
        return [_check("connection_use", "Connection use", "warn", "Connection statistics are unavailable.")]
    pct = facts.get("connection_pct")
    if pct is None:
        status = "info"
    elif pct >= CONNECTION_FAIL_PCT:
        status = "fail"
    elif pct >= CONNECTION_WARN_PCT:
        status = "warn"
    else:
        status = "ok"
    idle = facts["idle_in_xact"]
    running = facts["long_running"]
    return [
        _check(
            "connection_use",
            "Connection use",
            status,
            "Using {used} of {maximum} connections ({percent}).",
            used=facts["connections_total"],
            maximum=facts["connections_max"],
            percent=facts["connections_used"],
        ),
        _check(
            "idle_in_transaction",
            "Idle in transaction",
            "warn" if idle else "ok",
            "{count} session(s) are idle in a transaction." if idle else "No sessions are idle in a transaction.",
            count=idle,
        ),
        _check(
            "long_running_sessions",
            "Long-running sessions",
            "warn" if running else "ok",
            ("{count} session(s) have been running longer than 5 minutes." if running else "No sessions have been running longer than 5 minutes."),
            count=running,
        ),
    ]


def _server_checks(facts):
    if not facts.get("server_ok"):
        return [_check("transaction_id_age", "Transaction ID age", "warn", "Server statistics are unavailable.")]
    age = facts["xid_age"]
    if age >= XID_AGE_FAIL:
        status = "fail"
    elif age >= XID_AGE_WARN:
        status = "warn"
    else:
        status = "ok"
    return [_check("transaction_id_age", "Transaction ID age", status, "Transaction ID age is {age}.", age=age)]


def _activity_checks(facts):
    if not facts.get("activity_ok"):
        return [_check("database_activity", "Database activity", "warn", "Activity statistics are unavailable.")]
    blocks = facts["cache_blocks"]
    ratio = facts["cache_hit"]
    if blocks < CACHE_SAMPLE_MIN or ratio == "n/a":
        cache_status = "info"
    else:
        try:
            hit_pct = float(str(ratio).rstrip("%"))
        except ValueError:
            hit_pct = None
        if hit_pct is None:
            cache_status = "info"
        elif hit_pct < CACHE_FAIL_PCT:
            cache_status = "fail"
        elif hit_pct < CACHE_WARN_PCT:
            cache_status = "warn"
        else:
            cache_status = "ok"
    deadlocks = facts["deadlocks"]
    temp_files = facts["temp_files"]
    return [
        _check(
            "cache_hit_ratio",
            "Cache hit ratio",
            cache_status,
            "Cache hit ratio is {ratio} over {blocks} blocks.",
            ratio=ratio,
            blocks=blocks,
        ),
        _check(
            "deadlocks",
            "Deadlocks",
            "warn" if deadlocks else "ok",
            "{count} deadlock(s) since statistics reset." if deadlocks else "No deadlocks since statistics reset.",
            count=deadlocks,
        ),
        _check(
            "temporary_files",
            "Temporary files",
            "warn" if temp_files else "ok",
            ("{count} temporary file(s) ({size}) since statistics reset." if temp_files else "No temporary files since statistics reset."),
            count=temp_files,
            size=facts["temp_size"],
        ),
    ]


def _checkpoint_checks(facts):
    if not facts.get("checkpoints_ok"):
        return [_check("checkpoint_balance", "Checkpoint balance", "warn", "Checkpoint statistics are unavailable.")]
    timed = facts["checkpoints_timed"]
    requested = facts["checkpoints_requested"]
    if not timed + requested:
        status = "info"
    elif facts["checkpoint_pct"] < CHECKPOINT_WARN_PCT:
        status = "warn"
    else:
        status = "ok"
    detail = "No checkpoints recorded since statistics reset." if not timed + requested else "{percent} of checkpoints were timed ({timed} timed, {requested} requested)."
    return [
        _check(
            "checkpoint_balance",
            "Checkpoint balance",
            status,
            detail,
            percent=facts["checkpoint_pct_label"],
            timed=timed,
            requested=requested,
        )
    ]


def _replication_checks(facts):
    if not facts.get("replication_ok"):
        return [_check("replication_lag", "Replication lag", "warn", "Replication statistics are unavailable.")]
    replicas = facts["replicas"]
    if not replicas:
        return [_check("replication_lag", "Replication lag", "info", "No replicas are connected.")]
    lag = facts["replay_lag_seconds"]
    if lag is None:
        status = "info"
    elif lag >= REPLICATION_LAG_FAIL_SECONDS:
        status = "fail"
    elif lag >= REPLICATION_LAG_WARN_SECONDS:
        status = "warn"
    else:
        status = "ok"
    return [
        _check(
            "replication_lag",
            "Replication lag",
            status,
            "Longest replay lag is {lag} across {count} replica(s).",
            lag=facts["replay_lag"],
            count=replicas,
        )
    ]


def _health_checks(facts):
    checks = []
    checks.extend(_server_checks(facts))
    checks.extend(_connection_checks(facts))
    checks.extend(_activity_checks(facts))
    checks.extend(_checkpoint_checks(facts))
    checks.extend(_replication_checks(facts))
    severity = {"fail": 0, "warn": 1, "info": 2, "ok": 3}
    checks.sort(key=lambda check: (severity.get(check["status"], 99), check["label"]))
    return checks


def _overall_status(checks):
    if any(check["status"] == "fail" for check in checks):
        return "fail"
    if any(check["status"] == "warn" for check in checks):
        return "warn"
    return "ok"


def get_database_statistics():
    """Snapshot health counters and health checks for the current database."""
    if connection.vendor != "postgresql":
        return _unavailable_payload()

    rows = []
    facts = {}
    for section_rows, section_facts in (_server_rows(), _connection_rows(), _activity_rows()):
        rows.extend(section_rows)
        facts.update(section_facts)
    for section_rows, section_facts in (_checkpoint_rows(), _replication_rows()):
        rows.extend(section_rows)
        facts.update(section_facts)

    if not facts.get("server_ok") and not facts.get("connections_ok") and not facts.get("activity_ok"):
        return _unavailable_payload()

    checks = _health_checks(facts)
    summary = {
        "connections_used": facts.get("connections_used", "Unavailable"),
        "cache_hit": facts.get("cache_hit", "Unavailable"),
        "database_size": facts.get("database_size", "Unavailable"),
        "xid_age": facts.get("xid_age", "Unavailable"),
    }
    return {
        "available": True,
        "status": _overall_status(checks),
        "summary": summary,
        "rows": rows,
        "health_checks": checks,
        "health_counts": _count_checks(checks),
    }

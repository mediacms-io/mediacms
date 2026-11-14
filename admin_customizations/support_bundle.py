"""Redacted support bundle and starter issue text for the admin Get Support page."""

import re

from django.utils import timezone

from admin_customizations.admin import (
    get_site_configuration_status,
    get_site_health_checks,
)
from admin_customizations.database_stats import get_database_statistics
from admin_customizations.runtime_info import (
    get_installation_rows,
    get_system_runtime_rows,
)

BUNDLE_NOTE = "This file is safe to paste into a GitHub issue. Secrets are omitted or redacted."
BUNDLE_FILENAME = re.compile(r"^mediacms-support-\d{4}-\d{2}-\d{2}-\d{4}\.(txt|md)$")

DOCS_ADMIN = "https://github.com/mediacms-io/mediacms/blob/main/docs/admins_docs.md"
DOCS_TRANSLATIONS = "https://github.com/mediacms-io/mediacms/blob/main/docs/admins_docs.md#20-translations"
DOCS_TRANSCODING = "https://github.com/mediacms-io/mediacms/blob/main/docs/transcoding.md"
DOCS_EMAIL = "https://github.com/mediacms-io/mediacms/blob/main/docs/admins_docs.md#512-set-email-settings"
DOCS_PROXY = "https://github.com/mediacms-io/mediacms/blob/main/docs/admins_docs.md#advanced-deployment-with-reverse-proxy-accessed-as-httpmediacmsio"
DISCUSSIONS_URL = "https://github.com/mediacms-io/mediacms/discussions"
BUG_URL = "https://github.com/mediacms-io/mediacms/issues/new?template=bug_report.md"
FEATURE_URL = "https://github.com/mediacms-io/mediacms/issues/new?template=feature_request.md"
CONTACT_EMAIL = "info@mediacms.io"
SERVICES_URL = "https://mediacms.io/#services/"

SUPPORT_LINKS = (
    {"label": "Administrator documentation", "url": DOCS_ADMIN},
    {"label": "GitHub discussions", "url": DISCUSSIONS_URL},
    {"label": "Open a bug report", "url": BUG_URL},
    {"label": "Request a feature", "url": FEATURE_URL},
    {"label": "Contact MediaCMS", "url": f"mailto:{CONTACT_EMAIL}"},
    {"label": "Paid support", "url": SERVICES_URL},
)


def _cell(value):
    return str(value).replace("\t", " ").replace("\r", " ").replace("\n", " ")


def _tsv(headers, records):
    lines = ["\t".join(headers)]
    lines.extend("\t".join(_cell(value) for value in row) for row in records)
    return "\n".join(lines)


def _markdown_cell(value):
    return str(value).replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def _markdown_table(headers, records):
    header = "| " + " | ".join(_markdown_cell(item) for item in headers) + " |"
    separator = "| " + " | ".join("---" for _ in headers) + " |"
    body = ["| " + " | ".join(_markdown_cell(value) for value in row) + " |" for row in records]
    return "\n".join([header, separator, *body])


def _warning_records(database_stats=None):
    records = []
    for check in get_site_health_checks():
        if check["status"] in ("fail", "warn"):
            records.append((check["status"], check["label"], check["detail"]))
    if database_stats is None:
        database_stats = get_database_statistics()
    for check in database_stats.get("health_checks", []):
        if check["status"] in ("fail", "warn"):
            records.append((check["status"], check["label"], check["detail"]))
    return records


def support_bundle_filename(fmt, when=None):
    """Dated download name, for example mediacms-support-2026-11-13-0949.txt."""
    moment = timezone.localtime(when or timezone.now())
    extension = "md" if fmt == "md" else "txt"
    return moment.strftime(f"mediacms-support-%Y-%m-%d-%H%M.{extension}")


def support_bundle_format(filename):
    """Return txt or md when the filename is a safe dated bundle name."""
    match = BUNDLE_FILENAME.match(filename or "")
    if match is None:
        return None
    return match.group(1)


def render_support_bundle(fmt):
    """Build a text or Markdown dump of warnings, settings, and runtime facts."""
    generated = timezone.now().isoformat()
    database_stats = get_database_statistics()
    warnings = _warning_records(database_stats)
    configuration = [(item["label"], item["value"]) for item in get_site_configuration_status()]
    installation = [(item["label"], item["value"]) for item in get_installation_rows()]
    runtime = [(item["group"], item["label"], item["value"]) for item in get_system_runtime_rows()]
    database = [(item["group"], item["label"], item["value"]) for item in database_stats["rows"]]
    if fmt == "md":
        warning_body = _markdown_table(("Status", "Check", "Detail"), warnings) if warnings else "_No warnings or failures._"
        document = "\n\n".join(
            [
                "# MediaCMS support bundle",
                f"Generated at: {generated}",
                BUNDLE_NOTE,
                "## Installation",
                _markdown_table(("Name", "Value"), installation),
                "## Warnings and failures",
                warning_body,
                "## Configuration",
                _markdown_table(("Setting", "Value"), configuration),
                "## Runtime",
                _markdown_table(("Group", "Name", "Value"), runtime),
                "## Database",
                _markdown_table(("Group", "Name", "Value"), database),
            ]
        )
        return f"{document}\n"
    warning_body = _tsv(("Status", "Check", "Detail"), warnings) if warnings else "No warnings or failures."
    document = "\n\n".join(
        [
            "MediaCMS support bundle",
            f"Generated at: {generated}",
            BUNDLE_NOTE,
            "Installation",
            _tsv(("Name", "Value"), installation),
            "Warnings and failures",
            warning_body,
            "Configuration",
            _tsv(("Setting", "Value"), configuration),
            "Runtime",
            _tsv(("Group", "Name", "Value"), runtime),
            "Database",
            _tsv(("Group", "Name", "Value"), database),
        ]
    )
    return f"{document}\n"


def _example(example_id, title, doc_label, doc_url, body_lines):
    text = "\n".join(body_lines).strip() + "\n"
    markdown_lines = []
    for line in body_lines:
        if line.endswith(":") and line[:-1] in ("Describe the issue", "To reproduce", "Expected behavior", "Environment", "What I already checked"):
            markdown_lines.append(f"**{line[:-1]}**")
        else:
            markdown_lines.append(line)
    markdown = "\n".join(markdown_lines).strip() + "\n"
    return {
        "id": example_id,
        "title": title,
        "doc_label": doc_label,
        "doc_url": doc_url,
        "text": text,
        "markdown": markdown,
    }


SUPPORT_EXAMPLES = (
    _example(
        "translation",
        "Missing translation",
        "Translations",
        DOCS_TRANSLATIONS,
        [
            "Title: Missing translation for \"...\"",
            "",
            "Describe the issue:",
            "Language: ",
            "String that is still in English: ",
            "Where it appears (page or screen): ",
            "",
            "Expected behavior:",
            "The string is translated for this language.",
            "",
            "What I already checked:",
            f"Docs: {DOCS_TRANSLATIONS}",
            "Support bundle attached.",
        ],
    ),
    _example(
        "transcoding",
        "Transcoding failure",
        "Transcoding",
        DOCS_TRANSCODING,
        [
            "Title: Transcoding failed for media ...",
            "",
            "Describe the issue:",
            "Media id or URL: ",
            "Encode profile: ",
            "Encoding status: ",
            "",
            "To reproduce:",
            "1. Upload or open the media",
            "2. Wait for transcoding",
            "3. See the failed status",
            "",
            "Expected behavior:",
            "The media finishes transcoding and plays.",
            "",
            "What I already checked:",
            f"Docs: {DOCS_TRANSCODING}",
            "Support bundle attached.",
        ],
    ),
    _example(
        "playback",
        "Media not viewable",
        "Administrator documentation",
        DOCS_ADMIN,
        [
            "Title: Media will not play",
            "",
            "Describe the issue:",
            "Media URL: ",
            "Media type (video, audio, image, pdf): ",
            "Original playback fails: yes/no",
            "Encoded or HLS playback fails: yes/no",
            "Browser: ",
            "",
            "To reproduce:",
            "1. Open the media URL",
            "2. Press play or open the file",
            "3. See the error",
            "",
            "Expected behavior:",
            "The media opens and plays.",
            "",
            "What I already checked:",
            "Support bundle attached.",
        ],
    ),
    _example(
        "email",
        "Emails not sent",
        "Email settings",
        DOCS_EMAIL,
        [
            "Title: Emails are not sent",
            "",
            "Describe the issue:",
            "What should have sent mail (registration, password reset, other): ",
            "EMAIL_HOST: ",
            "EMAIL_PORT: ",
            "EMAIL_USE_TLS: ",
            "EMAIL_USE_SSL: ",
            "Do not include the mail password.",
            "",
            "Expected behavior:",
            "The message is delivered.",
            "",
            "What I already checked:",
            f"Docs: {DOCS_EMAIL}",
            "Support bundle attached.",
        ],
    ),
    _example(
        "proxy",
        "Reverse proxy",
        "Reverse proxy deployment",
        DOCS_PROXY,
        [
            "Title: Reverse proxy problem",
            "",
            "Describe the issue:",
            "Symptom (redirect loop, CSRF failure, mixed content, other): ",
            "FRONTEND_HOST: ",
            "Proxy (nginx, Traefik, other): ",
            "X-Forwarded-Proto / X-Forwarded-Host set: yes/no",
            "",
            "To reproduce:",
            "1. Open the public URL",
            "2. See the error",
            "",
            "Expected behavior:",
            "The site loads over the public HTTPS URL.",
            "",
            "What I already checked:",
            f"Docs: {DOCS_PROXY}",
            "Support bundle attached.",
        ],
    ),
    _example(
        "general",
        "Other / general",
        "Issue report template",
        BUG_URL,
        [
            "Title: ",
            "",
            "Describe the issue:",
            "",
            "To reproduce:",
            "1. ",
            "2. ",
            "3. ",
            "",
            "Expected behavior:",
            "",
            "Environment:",
            "OS: ",
            "Browser, if applicable: ",
            "MediaCMS version or image tag: ",
            "",
            "What I already checked:",
            f"Discussions: {DISCUSSIONS_URL}",
            "Support bundle attached.",
        ],
    ),
)

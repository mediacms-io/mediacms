from django.contrib import admin
from django.http import Http404, HttpResponse
from django.template.response import TemplateResponse
from django.utils.http import content_disposition_header

from admin_customizations.admin import calculate_statistics
from admin_customizations.support_bundle import (
    SUPPORT_EXAMPLES,
    SUPPORT_LINKS,
    render_support_bundle,
    support_bundle_filename,
    support_bundle_format,
)

DASHBOARD_SECTIONS = {
    "moderation": {
        "title": "Moderation",
        "template": "admin/dashboard/moderation.html",
        "icon": "fas fa-shield-alt",
    },
    "people": {
        "title": "People",
        "template": "admin/dashboard/people.html",
        "icon": "fas fa-users",
    },
    "library": {
        "title": "Library",
        "template": "admin/dashboard/library.html",
        "icon": "fas fa-photo-video",
    },
    "processing": {
        "title": "Processing",
        "template": "admin/dashboard/processing.html",
        "icon": "fas fa-cogs",
    },
    "engagement": {
        "title": "Engagement",
        "template": "admin/dashboard/engagement.html",
        "icon": "fas fa-heart",
    },
    "integrations": {
        "title": "Integrations",
        "template": "admin/dashboard/integrations.html",
        "icon": "fas fa-plug",
    },
    "site": {
        "title": "Site",
        "template": "admin/dashboard/site.html",
        "icon": "fas fa-sliders-h",
    },
    "health": {
        "title": "Health",
        "template": "admin/dashboard/health.html",
        "icon": "fas fa-heartbeat",
    },
    "configuration": {
        "title": "Configuration",
        "template": "admin/dashboard/configuration.html",
        "icon": "fas fa-cog",
    },
    "system": {
        "title": "System",
        "template": "admin/dashboard/system.html",
        "icon": "fas fa-server",
    },
    "support": {
        "title": "Get Support",
        "template": "admin/dashboard/support.html",
        "icon": "fas fa-life-ring",
    },
}


def dashboard_section(request, section):
    """Render a workflow-aligned dashboard detail page."""
    config = DASHBOARD_SECTIONS.get(section)
    if config is None:
        raise Http404("Unknown dashboard section")

    force_refresh = request.GET.get("refresh_stats") == "1" and request.user.is_staff
    context = {
        **admin.site.each_context(request),
        "title": config["title"],
        "dashboard_section": section,
        "dashboard_section_icon": config["icon"],
        "dashboard_stats": calculate_statistics(force_refresh=force_refresh),
    }
    if section == "support":
        context["support_examples"] = SUPPORT_EXAMPLES
        context["support_links"] = SUPPORT_LINKS
        context["support_bundle_txt"] = support_bundle_filename("txt")
        context["support_bundle_md"] = support_bundle_filename("md")
    return TemplateResponse(request, config["template"], context)


def support_bundle_download(request, filename):
    """Download a redacted text or Markdown support bundle."""
    fmt = support_bundle_format(filename)
    if fmt is None:
        raise Http404("Unknown support bundle filename")
    body = render_support_bundle(fmt)
    content_type = "text/markdown; charset=utf-8" if fmt == "md" else "text/plain; charset=utf-8"
    response = HttpResponse(body, content_type=content_type)
    response["Content-Disposition"] = content_disposition_header(True, filename)
    return response

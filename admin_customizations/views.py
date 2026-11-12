from django.contrib import admin
from django.http import Http404
from django.template.response import TemplateResponse

from admin_customizations.admin import calculate_statistics

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
    "site": {
        "title": "Site",
        "template": "admin/dashboard/site.html",
        "icon": "fas fa-sliders-h",
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
    return TemplateResponse(request, config["template"], context)

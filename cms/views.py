import re
import logging
from django.shortcuts import render, redirect
from django.core.paginator import Paginator

from files.models import Media, Tag
from files.methods import is_mediacms_editor

logger = logging.getLogger(__name__)

def _log_extra(request):
    """
    Helper to build the `extra` dict for logging calls.
    """
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        username = user.get_username()
        user_id = getattr(user, "id", None)
    else:
        username = "anonymous"
        user_id = None

    # session_key can be None; that's fine
    session_key = getattr(getattr(request, "session", None), "session_key", None)

    return {
        "username": username,
        "user_id": user_id,
        "session_key": session_key or "-",
    }

def advanced_search(request):

    extra = _log_extra(request)

    logger.debug("==== Advanced Search Called ====", extra=extra)
    logger.debug(
        "Request path: %s, GET: %s",
        request.path,
        dict(request.GET),
        extra=extra,
    )

    logger.debug(
        "Existing session advanced_search_last: %s",
        request.session.get("advanced_search_last"),
        extra=extra,
    )

    # ----------------------------
    # SESSION: Restore last search
    # ----------------------------
    clear_search = request.GET.get("clear") == "1"
    effective_get = {
        k: v for k, v in request.GET.items()
        if k not in ["clear", "page"]
    }
    has_filters = bool(effective_get)

    if request.user.is_authenticated:
        if clear_search:
            logger.debug("Clearing stored search", extra=extra)
            request.session.pop("advanced_search_last", None)

        elif not request.GET:
            last = request.session.get("advanced_search_last")
            logger.debug("No GET params. Trying last search from this session.", extra=extra)
            if last and last.startswith(request.path) and last != request.get_full_path():
                logger.debug("Redirecting user to stored search: %s", last, extra=extra)
                return redirect(last)

    else:
        logger.debug("User is NOT authenticated; session restore disabled.")

    # --- Tag filters -------------------------------------------------
    tag_ids_raw = request.GET.getlist("tags")
    selected_tag_ids = []
    for t in tag_ids_raw:
        try:
            selected_tag_ids.append(int(t))
        except (TypeError, ValueError):
            continue

    tag_mode = request.GET.get("tag_mode", "any")

    # --- Year dropdown -----------------------------------------------
    year_select_raw = request.GET.get("year_select", "").strip()
    selected_year_id = "All"
    selected_year_tag = "All"
    if year_select_raw:
        try:
            selected_year_id = int(year_select_raw)
        except (TypeError, ValueError):
            selected_year_id = "All"

    year_tag_id = selected_year_id if selected_year_id != "All" else None

    include_untagged = request.GET.get("untagged") == "1"
    include_untaggedyo = request.GET.get("untagged-yo") == "1"

    media_type = request.GET.get("media_type", "").strip()

    all_tags = Tag.objects.order_by("title")

    dc_tags = []
    dcbroad_tags = []
    selected_other_tags = []
    available_other_tags = []

    dcbroad_tag_ids = []
    non_dc_tag_ids = []

    for tag in all_tags:
        title = (tag.title or "").strip()

        is_dc = bool(re.match(r"^dc\d{4}$", title))
        is_dcbroad = bool(re.match(r"^dc\d{4}.*$", title))

        if is_dc:
            dc_tags.append(tag)
            if year_tag_id is not None and tag.id == year_tag_id:
                selected_year_tag = tag
        else:
            if tag.id in selected_tag_ids:
                selected_other_tags.append(tag)
            else:
                available_other_tags.append(tag)

        if is_dcbroad:
            dcbroad_tags.append(tag)
            dcbroad_tag_ids.append(tag.id)
        else:
            non_dc_tag_ids.append(tag.id)

    if year_tag_id is not None:
        other_tag_ids = [tid for tid in selected_tag_ids if tid != year_tag_id]
    else:
        other_tag_ids = list(selected_tag_ids)

    #ACSN has_filters = bool(request.GET)
    page_obj = None
    total_results = 0

    if has_filters:
        logger.debug("Running filtered search", extra=extra)

        base_qs = Media.objects.all().prefetch_related("tags")

        if media_type:
            base_qs = base_qs.filter(media_type=media_type)

        if year_tag_id is not None:
            base_qs = base_qs.filter(tags__id=year_tag_id)

        if other_tag_ids and include_untagged:
            if tag_mode == "all":
                tagged_qs = base_qs
                for tag_id in other_tag_ids:
                    tagged_qs = tagged_qs.filter(tags__id=tag_id)
            else:
                tagged_qs = base_qs.filter(tags__id__in=other_tag_ids)

            untagged_qs = base_qs.filter(tags__isnull=True)

            media_qs = (tagged_qs | untagged_qs).distinct()

        elif other_tag_ids:
            media_qs = base_qs
            if tag_mode == "all":
                for tag_id in other_tag_ids:
                    media_qs = media_qs.filter(tags__id=tag_id)
                media_qs = media_qs.distinct()
            else:
                media_qs = media_qs.filter(tags__id__in=other_tag_ids).distinct()

        elif include_untagged:
            media_qs = base_qs.filter(tags__isnull=True)

        elif include_untaggedyo:
            media_qs = base_qs.filter(tags__id__in=dcbroad_tag_ids)
            if non_dc_tag_ids:
                media_qs = media_qs.exclude(tags__id__in=non_dc_tag_ids)
            media_qs = media_qs.distinct()

        else:
            media_qs = base_qs

        media_qs = media_qs.order_by("-id").prefetch_related("tags")

        paginator = Paginator(media_qs, 24)
        page_number = request.GET.get("page")
        page_obj = paginator.get_page(page_number)
        total_results = paginator.count

    logger.debug("Total results found: %s", total_results, extra=extra)

    context = {
        "dc_tags": dc_tags,
        "selected_year_tag": selected_year_tag,
        "selected_other_tags": selected_other_tags,
        "available_other_tags": available_other_tags,
        "selected_tag_ids": selected_tag_ids,
        "tag_mode": tag_mode,
        "media_type": media_type,
        "include_untagged": include_untagged,
        "include_untaggedyo": include_untaggedyo,
        "page_obj": page_obj,
        "has_filters": has_filters,
        "total_results": total_results,
        "all_tags": all_tags,
        "is_editor": is_mediacms_editor(request.user) if request.user.is_authenticated else False,
    }

    # ----------------------------
    # SESSION: Save last search
    # ----------------------------
    if request.user.is_authenticated and not clear_search:
        logger.debug("Saving last search: %s", request.get_full_path(), extra=extra)
        request.session["advanced_search_last"] = request.get_full_path()

    return render(request, "cms/advanced_search.html", context)


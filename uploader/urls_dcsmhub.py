from django.urls import path

from .views_import_ui import (
    import_from_metadata_page,
    import_ui_list_dirs,
    import_ui_validate,
    import_ui_run,
    import_ui_job_status,
    import_ui_requeue,
    import_jobs_page,
    import_ui_list_jobs,
    import_ui_job_log,
    import_ui_create_metadata_a,
    import_ui_update_tags,
)

app_name = "uploader_dcsmhub"

urlpatterns = [
    # ---------------- APIs (FIRST) ----------------
    path("import-from-metadata/api/list/", import_ui_list_dirs, name="import_ui_list_dirs"),
    path("import-from-metadata/api/validate/", import_ui_validate, name="import_ui_validate"),
    path("import-from-metadata/api/run/", import_ui_run, name="import_ui_run"),

    path("import-from-metadata/api/jobs/", import_ui_list_jobs, name="import_ui_list_jobs"),
    path("import-from-metadata/api/job/<int:job_id>/", import_ui_job_status, name="import_ui_job_status"),
    path("import-from-metadata/api/job/<int:job_id>/log/", import_ui_job_log, name="import_ui_job_log"),
    path("import-from-metadata/api/requeue/<int:job_id>/", import_ui_requeue, name="import_ui_requeue"),

    path("import-from-metadata/api/create-metadata-a/", import_ui_create_metadata_a),
    path("import-from-metadata/api/update-tags/", import_ui_update_tags, name="import_ui_update_tags"),

    # ---------------- Pages (LAST) ----------------
    path("import-from-metadata/jobs/", import_jobs_page, name="import_jobs_page"),
    path("import-from-metadata/jobs", import_jobs_page, name="import_jobs_page"),  # optional
    path("import-from-metadata/", import_from_metadata_page, name="import_from_metadata_page"),
    path("import-from-metadata", import_from_metadata_page, name="import_from_metadata_page"),  # optional
]

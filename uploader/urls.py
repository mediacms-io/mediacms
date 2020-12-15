# -*- coding: utf-8 -*-
from django.conf.urls import url

from . import views

app_name = "uploader"

urlpatterns = [
    url(r"^upload/$", views.FineUploaderView.as_view(), name="upload"),
]

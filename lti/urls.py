"""
LTI 1.3 URL Configuration for MediaCMS
"""

from django.urls import path

from . import deep_linking, views

app_name = 'lti'

urlpatterns = [
    path('oidc/login/', views.OIDCLoginView.as_view(), name='oidc_login'),
    path('launch/', views.LaunchView.as_view(), name='launch'),
    path('jwks/', views.JWKSView.as_view(), name='jwks'),
    path('public-key/', views.PublicKeyPEMView.as_view(), name='public_key_pem'),
    path('select-media/', deep_linking.SelectMediaView.as_view(), name='select_media'),
    path('my-media/', views.MyMediaLTIView.as_view(), name='my_media'),
    path('embed/<str:friendly_token>/', views.EmbedMediaLTIView.as_view(), name='embed_media'),
]

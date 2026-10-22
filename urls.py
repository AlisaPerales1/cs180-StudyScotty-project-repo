from django.urls import path
from .views import SpotListView

urlpatterns = [
    path("spots/", SpotListView.as_view(), name="spot-list"),
]

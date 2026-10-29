from django.contrib import admin

from .models import Spot, SpotPhoto, OpeningHours, Review, Favorite, BusynessReport

admin.site.register([Spot, SpotPhoto, OpeningHours, Review, Favorite, BusynessReport])

from django.contrib import admin

from .models import AbuseReport, SessionCreationRestriction

admin.site.register([AbuseReport, SessionCreationRestriction])

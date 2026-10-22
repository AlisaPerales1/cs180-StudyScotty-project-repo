from django.contrib import admin

from .models import StudySession, RSVP, SessionCheckIn

admin.site.register([StudySession, RSVP, SessionCheckIn])

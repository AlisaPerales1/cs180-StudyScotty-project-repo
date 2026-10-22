from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Course, User, UserCourse, UserProfile

admin.site.register(User, UserAdmin)

admin.site.register([Course, UserCourse, UserProfile])

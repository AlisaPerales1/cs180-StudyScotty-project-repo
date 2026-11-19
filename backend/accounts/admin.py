from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Course, GoogleIdentity, User, UserCourse, UserProfile

admin.site.register(User, UserAdmin)

admin.site.register([Course, UserCourse, UserProfile])


@admin.register(GoogleIdentity)
class GoogleIdentityAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at")
    readonly_fields = ("user", "google_sub", "created_at")

    def has_add_permission(self, request):
        return False

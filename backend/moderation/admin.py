from django.contrib import admin

from .models import AbuseReport, AccountModerationAction, SessionCreationRestriction

admin.site.register([AbuseReport, SessionCreationRestriction])


@admin.register(AccountModerationAction)
class AccountModerationActionAdmin(admin.ModelAdmin):
    list_display = ["user", "action", "performed_by", "created_at", "ends_at"]
    list_filter = ["action"]
    readonly_fields = ["user", "action", "performed_by", "reason", "created_at", "ends_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

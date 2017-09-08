from django.contrib import admin
from classify.models import TagLabel, ClassLabel, Timeseries

class TagLabelAdmin(admin.ModelAdmin):
    list_display = ('name',)
    readonly_fields = ('id',)
    def has_delete_permission(self, request, obj=None):
        return False
    
class ClassLabelAdmin(admin.ModelAdmin):
    list_display = ('name',)
    readonly_fields = ('id',)
    def has_delete_permission(self, request, obj=None):
        return False
    
class TimeseriesAdmin(admin.ModelAdmin):
    list_display = ('url',)
    readonly_fields = ('id',)
    def has_delete_permission(self, request, obj=None):
        return False

admin.site.register(TagLabel, TagLabelAdmin)
admin.site.register(ClassLabel, ClassLabelAdmin)
admin.site.register(Timeseries, TimeseriesAdmin)
admin.site.disable_action('delete_selected')

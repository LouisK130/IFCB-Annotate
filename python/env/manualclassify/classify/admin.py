from django.contrib import admin
from classify.models import TagLabel, ClassLabel, Timeseries

class TagLabelAdmin(admin.ModelAdmin):
	list_display = ('name',)
	
class ClassLabelAdmin(admin.ModelAdmin):
	list_display = ('name',)
	
class TimeseriesAdmin(admin.ModelAdmin):
	list_display = ('url',)

admin.site.register(TagLabel, TagLabelAdmin)
admin.site.register(ClassLabel, ClassLabelAdmin)
admin.site.register(Timeseries, TimeseriesAdmin)
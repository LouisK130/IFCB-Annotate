from django.db import models
from django.contrib.auth.models import Group, User

class ClassLabel(models.Model):
	name = models.CharField(max_length=300)
	international_id = models.IntegerField(null=True, blank=True)
	
class TagLabel(models.Model):
	name = models.CharField(max_length=300)
	
class Timeseries(models.Model):
	id = models.CharField(max_length=36, primary_key=True)
	url = models.CharField(max_length=1000)
	class Meta:
		verbose_name_plural = 'Timeseries'

# add some fields and methods to User and Group

Group.add_to_class('power', models.IntegerField(default=0))

def get_group_power(self):
	if self.power:
		return self.power
	return 0

Group.add_to_class('get_group_power', get_group_power)

def get_user_power(self):
	power = 0
	for g in self.groups.all():
		if g.get_group_power() > power:
			power = g.get_group_power()
	return power

User.add_to_class('get_user_power', get_user_power)
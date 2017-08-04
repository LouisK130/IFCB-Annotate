from django.db import models
from django.contrib.auth.models import Group, User

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
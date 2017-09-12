from django.db import models
from django.contrib.auth.models import Group, User
import uuid

class ClassLabel(models.Model):
    name = models.CharField(max_length=300)
    international_id = models.IntegerField(null=True, blank=True)
    
class TagLabel(models.Model):
    name = models.CharField(max_length=300)
    
class Timeseries(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid1)
    url = models.CharField(max_length=1000)
    class Meta:
        verbose_name_plural = 'Timeseries'

class Classification(models.Model):
    bin = models.CharField(max_length=100)
    roi = models.IntegerField()
    user_id = models.IntegerField()
    time = models.DateTimeField(auto_now_add=True)
    classification_id = models.IntegerField()
    level = models.IntegerField(default=1)
    verifications = models.IntegerField(default=0)
    verification_time = models.DateTimeField(null=True, blank=True)
    timeseries_id = models.CharField(max_length=36)
    class Meta:
        unique_together = (('bin', 'roi', 'user_id', 'classification_id'),)
    
class Tag(models.Model):
    bin = models.CharField(max_length=100)
    roi = models.IntegerField()
    user_id = models.IntegerField()
    time = models.DateTimeField(auto_now_add=True)
    tag_id = models.IntegerField()
    level = models.IntegerField(default=1)
    verifications = models.IntegerField(default=0)
    verification_time = models.DateTimeField(null=True, blank=True)
    timeseries_id = models.CharField(max_length=36)
    negation = models.BooleanField(default=False)
    class Meta:
        unique_together = (('bin', 'roi', 'user_id', 'tag_id', 'negation'),)

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

from django.conf import settings as S

db_config = S.DATABASES['default']

db = db_config['NAME']
username = db_config['USER']
password = db_config['PASSWORD']
server = db_config['HOST']

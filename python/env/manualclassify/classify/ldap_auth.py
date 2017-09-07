import re

from ldap3 import Server, Connection

from django.contrib.auth.models import User
from django.conf import settings as S

def ldap_login(username, password):
    # validate username
    if not re.match(r'[a-z]+',username.lower()):
        return False

    # WHOI LDAP AD proxy server
    server = Server(S.LDAP_HOST, port=S.LDAP_PORT, use_ssl=S.LDAP_SSL)
    # connect as lookup user
    conn = Connection(server, S.LDAP_SEARCH_DN, S.LDAP_SEARCH_PW, auto_bind=True)

    # search by username
    search_filter = '(&(objectClass=person)(sAMAccountname={}))'.format(username)

    conn.search(S.LDAP_SEARCH_BASE, search_filter)

    # only one response will be the search result entry
    # and its DN is the user's DN
    user_dn = None

    for entry in conn.response:
        if(entry['type'] == 'searchResEntry'):
            user_dn = entry['dn']
            break

    if not user_dn:
        return False
        
    # close connection
    conn.unbind()

    # connect with user's DN and password
    conn = Connection(server, user_dn, password)
    # attempt to authenticate and record result
    logged_in = conn.bind()
    # close connection
    conn.unbind()

    # return whether login worked
    return logged_in

class LdapBackend:
    # authenticate via LDAP
    def authenticate(self, username=None, password=None):
        if not ldap_login(username, password):
            return None

        # we're authenticated. attempt to return the user
        # if the django user does not exist, will cause auth to fail
        return User.objects.get(username=username)

    # Required for the backend to work properly
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

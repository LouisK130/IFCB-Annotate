% setdbprefs('DataReturnFormat', 'table')
function conn = getDBConnection();

    db_name = "database";
    username = "postgres";
    pass = "password";
    server = "localhost";
    conn = database(db_name, username, pass, 'Vendor', 'PostgreSQL', 'Server', server);

end
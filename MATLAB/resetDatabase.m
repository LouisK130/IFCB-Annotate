conn = getDBConnection();

a = 'TRUNCATE classifications, classification_labels, tag_labels, tags';
b = 'ALTER SEQUENCE classification_labels_id_seq RESTART';
c = 'ALTER SEQUENCE classifications_id_seq RESTART';
d = 'ALTER SEQUENCE tags_id_seq RESTART';
e = 'ALTER SEQUENCE tag_labels_id_seq RESTART';

exec(conn, a);
exec(conn, b);
exec(conn, c);
exec(conn, d);
exec(conn, e);
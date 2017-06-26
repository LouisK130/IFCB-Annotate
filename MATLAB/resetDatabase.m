conn = getDBConnection();

a = 'TRUNCATE classifications, classification_labels, tag_labels, tags, timeseries';
b = 'ALTER SEQUENCE classification_labels_id_seq RESTART';
c = 'ALTER SEQUENCE classifications_id_seq RESTART';
d = 'ALTER SEQUENCE tags_id_seq RESTART';
e = 'ALTER SEQUENCE tag_labels_id_seq RESTART';
f = 'INSERT INTO timeseries (id, url) VALUES (''341fae31-89d7-4f27-ba25-27d2c9216dc0'', ''http://ifcb-data.whoi.edu/mvco/'')';

exec(conn, a);
exec(conn, b);
exec(conn, c);
exec(conn, d);
exec(conn, e);
exec(conn, f);
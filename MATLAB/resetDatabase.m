conn = getDBConnection();

a = 'TRUNCATE classify_classification, classify_classlabel, classify_taglabel, classify_tag, classify_timeseries';
b = 'ALTER SEQUENCE classify_classlabel_id_seq RESTART';
c = 'ALTER SEQUENCE classify_classification_id_seq RESTART';
d = 'ALTER SEQUENCE classify_tag_id_seq RESTART';
e = 'ALTER SEQUENCE classify_taglabel_id_seq RESTART';
f = 'INSERT INTO classify_timeseries (id, url) VALUES (''341fae31-89d7-4f27-ba25-27d2c9216dc0'', ''http://ifcb-data.whoi.edu/mvco/'')';

exec(conn, a);
exec(conn, b);
exec(conn, c);
exec(conn, d);
exec(conn, e);
exec(conn, f);
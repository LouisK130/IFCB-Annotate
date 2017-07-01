conn = getDBConnection();
csvs = dir('C:\Users\Louis\Desktop\Manual-Classify-old\csv\bins,rois no timeseries\*.csv');

query = 'SELECT id FROM timeseries WHERE url = ''http://ifcb-data.whoi.edu/mvco/'';';
cursor = exec(conn, query);
cursor = fetch(cursor);
result = cursor.Data{1,1}{1};

query = sprintf('ALTER TABLE classifications ALTER COLUMN timeseries_id SET DEFAULT ''%s'';', result);
exec(conn, query);
query = sprintf('ALTER TABLE tags ALTER column timeseries_id SET DEFAULT ''%s'';', result);
exec(conn, query);

for csv = csvs'
    name = strrep(csv.name, '.csv', '');
    insertData4(conn, name, sprintf('%s\\%s', csv.folder, csv.name));
end

exec(conn, 'ATLER TABLE classifications ALTER COLUMN timeseries_id DROP DEFAULT;');
exec(conn, 'ALTER TABLE tags ALTER COLUMN timeseries_id DROP DEFAULT;');
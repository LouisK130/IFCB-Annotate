conn = getDBConnection();
csvs = dir('C:\Users\Louis\Desktop\Manual Classify\csv\bins,rois\*.csv');
for csv = csvs'
    name = strrep(csv.name, '.csv', '');
    insertData4(conn, name, sprintf('%s\\%s', csv.folder, csv.name));
end
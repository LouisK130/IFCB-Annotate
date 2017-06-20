conn = getDBConnection();

load('class_table_mvco.mat')
    
query = 'INSERT INTO classification_labels (name, international_id) VALUES ';

for i = 1:height(class_table_mvco)
    if ~isnan(class_table_mvco{i,4}{1})
        continue;
    end
    name = class_table_mvco{i,3}{1};
    name = strrep(name, '_', ' ');
    iid = sprintf('%d', class_table_mvco{i,5});
    if iid == "NaN"
        iid = 'DEFAULT';
    end
    query = strcat(query, sprintf('(''%s'', %s), ', name, iid));
end

query = strcat(query(1:end-1), ';');
exec(conn, query);
tic

conn = getDBConnection();

if ~isopen(conn)
    fprintf('ERROR: No connection, are your credentials correct?\n');
    return;
end

query = fileread('summaryOneQuery.sql');
cursor = exec(conn, query);
cursor = fetch(cursor);
data = cursor.Data;

save('summaryOne_results.mat', 'data');

fprintf('Query complete, results are available in summaryOne_results.mat\n');

toc
% note that if you supply an invalid `class` or `tag`, no error will appear
% but the result `data` will be empty, so double check inputs
function summaryTwo(class, tag)
    
    tic
    conn = getDBConnection();

    if ~isopen(conn)
        fprintf('ERROR: No connection, are your credentials correct?\n');
        return;
    end
    
    query = fileread('summaryTwoQuery.sql');
    query = sprintf(query, class, tag);
    
    cursor = exec(conn, query);
    cursor = fetch(cursor);
    data = cursor.Data;
    
    filename = sprintf('summaryTwo_results_%s_%s.mat', class, tag);
    save(filename, 'data');
    
    fprintf('Query complete, results are available in %s\n', filename);
    toc
    
end
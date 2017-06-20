function result = insertTag(conn, pid, user, tag_name, level)

    % This check is performed in lookupTagID
    %if ~isopen(conn)
    %    result = 'No connection';
    %    return;
    %end

    [id, error] = lookupTagID(conn, tag_name);
    
    if id < 0
        error1 = createTagLabel(conn, tag_name);

    if ~isempty(error)
        result = error;
        return;
    end

    query = 'INSERT INTO tags (pid, user_id, tag_id, level) VALUES (''%s'', %d, %d, %d);';
    query = sprintf(query, pid, user, id, level);
    response = exec(conn, query);
    result = response.Message;

end


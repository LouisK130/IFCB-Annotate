function result = insertClassification(conn, pid, user, classification, level)

    % This check is performed in lookupClassificationID
    %if ~isopen(conn)
    %    result = 'No connection';
    %    return;
    %end

    [id, error] = lookupClassificationID(conn, classification);

    if ~isempty(error)
        result = error;
        return;
    end

    query = 'INSERT INTO classifications (pid, user_id, classification_id, level) VALUES (''%s'', %d, %d, %d);';
    query = sprintf(query, pid, user, id, level);
    response = exec(conn, query);
    result = response.Message;

end
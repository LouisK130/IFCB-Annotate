function [tags, error] = getTags(conn, pid)
    
    tags = {};
    error = '';

    if ~isopen(conn)
        error = 'No connection';
        return;
    end

    query = sprintf('SELECT * FROM tags WHERE pid = ''%s'';', pid);
    response = exec(conn, query);
    cursor = fetch(response);

    if ~isempty(response.Message)
        error = response.Message;
        return;
    end

    tags = cursor.Data;

end
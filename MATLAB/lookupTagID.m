function [tag_id, error] = lookupTagID(conn, tag_name)

    tag_id = -1;
    error = '';

    if ~isopen(conn)
        error = 'No connection';
        return;
    end

    query = sprintf('SELECT * FROM classify_taglabel WHERE name = ''%s'';', tag_name);
    cursor = exec(conn, query);

    if ~isempty(cursor.Message)
        error = cursor.Message;
        return;
    end

    cursor = fetch(cursor);
    result = cursor.Data{1,1};

    if result == 'No Data'
        error = 'Invalid tag name';
        return;
    end

    tag_id = result;

end


function [classification_id, error] = lookupClassificationID(conn, name)

    classification_id = -1;
    error = '';

    if ~isopen(conn)
        error = 'No connection';
        return;
    end

    query = sprintf('SELECT id FROM classify_classlabel WHERE name = ''%s'';', name);
    cursor = exec(conn, query);

    if ~isempty(cursor.Message)
        error = cursor.Message;
        return;
    end

    cursor = fetch(cursor);
    result = cursor.Data{1,1};

    if result == 'No Data' % invalid name
        error = 'Invalid classification name';
        return;
    end

    classification_id = result;

end
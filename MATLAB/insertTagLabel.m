function result = insertTagLabel(conn, tag_name)

    if ~isopen(conn)
        result = 'No connection';
        return;
    end

    query = sprintf('INSERT INTO facet_labels (name) VALUES (''%s'');', tag_name);
    response = exec(conn, query);
    result = response.Message;

end
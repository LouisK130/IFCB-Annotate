function result = createTagLabel( conn, tag_name )

    if ~isopen(conn)
        result = 'No connection';
        return;
    end
    
    % Stupid MATLAB doesn't seem to support INSERT INTO ... RETURNING
    % So we can't just return the tag_id here, we have to go get it later
    
    query = sprintf('INSERT INTO classify_taglabel (name) VALUES (''%s'');', tag_name);
    response = exec(conn, query);
    result = response.Message;

end


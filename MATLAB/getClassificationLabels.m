function [classification_labels, error] = getClassificationLabels( conn )

    classification_labels = {};
    error = '';

    if ~isopen(conn)
        error = 'No connection';
        return;
    end
    
    query = 'SELECT * FROM classification_labels;';
    response = exec(conn, query);
    cursor = fetch(response);
    
    if ~isempty(response.Message)
        error = response.Message;
        return;
    end
    
    classification_labels = cursor.Data(:,2);

end


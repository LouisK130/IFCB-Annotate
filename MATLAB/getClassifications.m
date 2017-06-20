function [classifications, error] = getClassifications(conn, pids)
    
    classifications = zeros(size(pids,1),1);
    error = '';

    if ~isopen(conn)
        error = 'No connection';
        return;
    end
    
    pids_formatted = [repmat('(''', size(pids,1), 1) pids repmat(''')', size(pids,1), 1)];
    pids_formatted = strjoin(cellstr(pids_formatted), ',');
    
    query = 'SELECT pid, classification_id FROM classifications WHERE pid = ANY (VALUES %s);';
    query = sprintf(query, pids_formatted);
    
    response = exec(conn, query);
    cursor = fetch(response);

    if ~isempty(response.Message)
        error = response.Message;
        return;
    end
    
    classifications = cursor.Data;

end


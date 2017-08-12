function summaryTwo(class, tag)

    conn = getDBConnection();

    if ~isopen(conn)
        fprintf('ERROR: No connection, are your credentials correct?\n');
        return;
    end
    
    query = 'SELECT id FROM classify_classlabel WHERE name = ''%s'';';
    query = sprintf(query, class);
    cursor = exec(conn, query);
    cursor = fetch(cursor);
    class_id = cursor.Data{1,1};
    
    if class_id == 'No Data'
        fprintf('ERROR: Invalid class given\n')
        return;
    end
    
    query = 'SELECT * FROM classify_classification WHERE classification_id = %d;';
    query = sprintf(query, class_id);
    cursor = exec(conn, query);
    cursor = fetch(cursor);
    class_data = cursor.Data;
    
    tag_data = NaN;
    
    if tag
        
        query = 'SELECT id from classify_taglabel WHERE name = ''%s'';';
        query = sprintf(query, tag);
        cursor = exec(conn, query);
        cursor = fetch(cursor);
        tag_id = cursor.Data{1,1};
        
        if tag_id == 'No Data'
            fprintf('ERROR: Invalid tag given\n')
            return;
        end
        
        query = 'SELECT * FROM classify_tag WHERE tag_id = %d';
        query = sprintf(query, tag_id);
        cursor = exec(conn, query);
        cursor = fetch(cursor);
        tag_data = cursor.Data;

    end
    
    bins = {};
    results = {};
    
    for i = 1:size(class_data, 1)
        bin = class_data{i,2}{1};
        row_index = find(ismember(bins,bin));
        if isempty(row_index)
            bins{size(bins,1)+1,1} = bin;
            row_index = size(bins,1);
        end
        if size(results,1) < row_index
            results(row_index,1) = {0};
        end
        valid = ~istable(tag_data);
        if ~valid
            bin_matches = tag_data(find(strcmp(bin, tag_data.bin)), :);
            matches = bin_matches(find(bin_matches.roi == class_data{i,3}), :);
            if ~isempty(matches)
                valid = true;
            end
        end
        if valid
            results{row_index,1} = results{row_index,1} + 1;
        end
    end
    final_results = [bins results];
    save('summaryTwo_results.mat', 'final_results');
end
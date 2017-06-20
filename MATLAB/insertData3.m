function insertData3(conn, old_classification, file)

    load('class_table_mvco.mat')
    index = strcmp(class_table_mvco{:,1}, old_classification);
    new_classification = class_table_mvco{index,3}{1};
    new_classification = strrep(new_classification, '_', ' ');
    new_classification_id = lookupClassificationID(conn, new_classification);
    
    if new_classification_id < 0
        fprintf('Failed to find classification ID for %s\n', file);
        return;
    end
    
    tag_label = class_table_mvco{index,4}{1};
    
    % if this entry needs a tag, make sure we can find/make it
    if ~isnan(tag_label)
        
        % This potentially requires 3 queries...
        tag_id = lookupTagID(conn, tag_label);
        if tag_id < 0
            error = createTagLabel(conn, tag_label);
            if isempty(error)
                tag_id = lookupTagID(conn, tag_label);
            else
                fprintf('Failed to create tag_label ''%s'' for ''%s''\n', tag_label, file);
                return;
            end
        end
        
    end
    query = '';
    fid = fopen(file, 'r');
    tline = fgetl(fid);
    while ischar(tline)
        both = strsplit(tline, ',');
        bin = both{1};
        roi = both{2};
        s_query = 'INSERT INTO classifications (bin, roi, classification_id) VALUES ((''%s''), (''%s''), (%d)) ON CONFLICT DO NOTHING;';
        s_query = sprintf(s_query, bin, roi, new_classification_id);
        query = strcat(query, s_query);
        if ~isnan(tag_label)
            s_query = 'INSERT INTO tags (bin, roi, tag_id) VALUES ((''%s''), (''%s''), (%d)) ON CONFLICT DO NOTHING;';
            s_query = sprintf(s_query, bin, roi, tag_id);
            query = strcat(query, s_query);
        end
        tline = fgetl(fid);
    end
    fclose(fid);
    result = exec(conn, query);
    
    if isempty(result.Message)
        fprintf('Successfully imported classifications for %s\n', file);
    else
        fprintf('%s\n', result.Message);
        fprintf('Failed to import classifications for %s\n', file);
    end

end
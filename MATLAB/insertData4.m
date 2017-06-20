function insertData(conn, old_classification, file)

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
    
    query = ['CREATE TEMP TABLE tmp_table ON COMMIT DROP AS SELECT bin, roi, classification_id ' ...
        'FROM classifications WITH NO DATA; ' ...
        'ALTER TABLE tmp_table ALTER COLUMN classification_id SET DEFAULT ''%d''; ' ...
        'COPY tmp_table (bin,roi) FROM ''%s'' CSV; ' ...
        'INSERT INTO classifications (bin, roi, classification_id) SELECT DISTINCT ON ' ...
        '(bin, roi, classification_id) * FROM tmp_table ORDER BY classification_id, bin, roi;'];
    query = sprintf(query, new_classification_id, file);
    result = exec(conn, query);
    
    if isempty(result.Message)
        fprintf('Successfully imported classifications for %s\n', file);
    else
        fprintf('Failed to import classifications for %s\n', file);
        fprintf('%s\n', result.Message);
    end
    
    % add tags after, if needed
    if ~isnan(tag_label)
        
        query = ['CREATE TEMP TABLE tmp_table ON COMMIT DROP AS SELECT bin, roi, tag_id ' ...
            'FROM tags WITH NO DATA; ' ...
            'ALTER TABLE tmp_table ALTER COLUMN tag_id SET DEFAULT ''%d''; ' ...
            'COPY tmp_table (bin,roi) FROM ''%s'' CSV; ' ...
            'INSERT INTO tags (bin, roi, tag_id) SELECT DISTINCT ON ' ...
            '(bin, roi, tag_id) * FROM tmp_table ORDER BY bin, roi, tag_id;'];
        query = sprintf(query, tag_id, file);
        result_tag = exec(conn, query);
        
        if isempty(result_tag.Message)
            fprintf('Successfully imported tags for %s\n', file);
        else
            fprintf('%s\n', result_tag.Message);
            fprintf('Failed to import tags for %s\n', file);
        end
        
    end
    
end
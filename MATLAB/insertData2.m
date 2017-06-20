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

    update_default = 'ALTER TABLE classifications ALTER COLUMN classification_id SET DEFAULT ''%d'';';
    update_default = sprintf(update_default, new_classification_id);
    exec(conn, update_default);

    copy_data = 'COPY classifications (bin,roi) FROM ''%s'' CSV;';
    copy_data = sprintf(copy_data, file);
    result = exec(conn, copy_data);

    reset_default = 'ALTER TABLE classifications ALTER COLUMN classification_id DROP DEFAULT;';
    exec(conn, reset_default);
    
    if strcmp(result.Message, 'No results were returned by the query.')
        fprintf('Successfully imported classifications for %s\n', file);
    else
        fprintf(result.Message);
        fprintf('Failed to import classifications for %s\n', file);
    end
    
    % add tags after, if needed
    if ~isnan(tag_label)
        
        update_default_tag = 'ALTER TABLE tags ALTER COLUMN tag_id SET DEFAULT ''%d'';';
        update_default_tag = sprintf(update_default_tag, tag_id);
        exec(conn, update_default_tag);
    
        copy_data_tag = 'COPY tags (bin,roi) FROM ''%s'' CSV;';
        copy_data_tag = sprintf(copy_data_tag, file);
        result_tag = exec(conn, copy_data_tag);
        
        reset_default_tag = 'ALTER TABLE tags ALTER COLUMN tag_id DROP DEFAULT;';
        exec(conn, reset_default_tag);
        
        if strcmp(result_tag.Message, 'No results were returned by the query.')
            fprintf('Successfully imported tags for %s\n', file);
        else
            fprintf('Failed to import tags for %s\n', file);
        end
        
    end
    
end
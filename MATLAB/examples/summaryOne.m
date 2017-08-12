tic

conn = getDBConnection();

if ~isopen(conn)
    fprintf('ERROR: No connection, are your credentials correct?\n');
    return;
end

query = 'SELECT * FROM classify_classlabel';
cursor = exec(conn, query);
cursor = fetch(cursor);
label_data = cursor.Data;

labels = label_data{:,2}';
label_ids = label_data{:,1}';

query = 'SELECT * FROM classify_classification;';
cursor = exec(conn, query);
cursor = fetch(cursor);
data = cursor.Data;

fprintf('Fetched all data, processing...\n');
toc
tic

bins = {};

results = cell(0, size(labels,2));

% surely a loop is not the most efficient way to do this
% but it's simplest for me and this is only a basic example
for i = 1:size(data,1)
    bin = data{i,2}{1};
    id = data{i,6};
    col_index = find(ismember(label_ids,id));
    row_index = find(ismember(bins,bin));
    if isempty(row_index)
        bins{size(bins,1)+1,1} = bin;
        row_index = size(bins,1);
    end
    if size(results,1) < row_index
        results(row_index,:) = {0};
    end
    results{row_index,col_index} = results{row_index,col_index} + 1;
end

labels = ['bin' labels];
results = [bins results];
results = [labels; results];

save('summaryOne_results.mat', 'results');

fprintf('Processing complete, results are available in summaryOne_results.mat\n');
toc % total execution time on my machine: about 22 minutes
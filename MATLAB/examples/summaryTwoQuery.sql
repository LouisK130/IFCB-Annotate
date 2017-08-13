WITH
	CI AS (
        SELECT id FROM classify_classlabel WHERE name = '%s'
    ),
    TI AS (
        SELECT id FROM classify_taglabel WHERE name = '%s'
    ),
	TA AS (
        SELECT DISTINCT ON (t.bin, t.roi, t.tag_id) t.*, p.power
            FROM classify_tag t, auth_user_groups g, auth_group p
            WHERE t.user_id = g.user_id
            AND p.id = g.group_id
            ORDER BY t.bin, t.roi, t.tag_id, p.power DESC, t.verification_time DESC, t.time DESC
    ),
	TF AS (
        SELECT * FROM TA,TI WHERE TA.tag_id = TI.id AND negation = false
    ),
	CA AS (
        SELECT DISTINCT ON (c.bin, c.roi) c.*, p.power
            FROM classify_classification c, auth_user_groups g, auth_group p
            WHERE c.user_id = g.user_id
            AND p.id = g.group_id
            ORDER BY c.bin, c.roi, p.power DESC, c.verification_time DESC, c.time DESC
    ),
	CF AS (
        SELECT * FROM CA,CI WHERE CA.classification_id = CI.id
    )

SELECT bin, COUNT(*) FROM CF
	WHERE EXISTS
    	(SELECT 1 FROM TF
         	WHERE TF.roi = CF.roi
         	AND TF.bin = CF.bin
        )
	GROUP BY bin;
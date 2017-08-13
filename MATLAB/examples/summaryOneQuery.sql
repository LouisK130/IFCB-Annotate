WITH
	CA AS (
        SELECT DISTINCT ON (c.bin, c.roi) c.*, p.power
            FROM classify_classification c, auth_user_groups g, auth_group p
            WHERE c.user_id = g.user_id
            AND p.id = g.group_id
            ORDER BY c.bin, c.roi, p.power DESC, c.verification_time DESC, c.time DESC
    )

SELECT bin, classification_id, COUNT(id)
	FROM CA
	GROUP BY (bin, classification_id)
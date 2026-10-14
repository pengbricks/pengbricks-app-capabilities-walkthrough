-- SCD type 1 and type 2 from one change feed with AUTO CDC.
-- accounts_changes is an append-only Delta table: one row per change with change_type
-- (INSERT, UPDATE, DELETE) and change_seq (1 = initial snapshot, 2 = change batch).

-- Type 1: one current row per key. Updates overwrite; deletes remove the row.
CREATE OR REFRESH STREAMING TABLE accounts_scd1;

CREATE FLOW accounts_scd1_flow AS AUTO CDC INTO accounts_scd1
FROM STREAM(accounts_changes)
KEYS (account_id)
APPLY AS DELETE WHEN change_type = 'DELETE'
SEQUENCE BY change_seq
COLUMNS * EXCEPT (change_type, change_seq)
STORED AS SCD TYPE 1;

-- Type 2: every version is kept with __START_AT and __END_AT.
-- A delete closes the current version (sets __END_AT) and adds no new row.
CREATE OR REFRESH STREAMING TABLE accounts_scd2;

CREATE FLOW accounts_scd2_flow AS AUTO CDC INTO accounts_scd2
FROM STREAM(accounts_changes)
KEYS (account_id)
APPLY AS DELETE WHEN change_type = 'DELETE'
SEQUENCE BY change_seq
COLUMNS * EXCEPT (change_type, change_seq)
STORED AS SCD TYPE 2;

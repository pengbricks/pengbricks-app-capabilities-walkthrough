-- Run by the sql_checks task. assert_true fails the task when a check does not hold.
SELECT
  assert_true(COUNT(*) > 0, 'output table is empty') AS non_empty,
  assert_true(COUNT(*) = COUNT(DISTINCT IDENTIFIER(:key_column)), 'keys must be unique') AS unique_keys,
  assert_true(COUNT(IDENTIFIER(:key_column)) = COUNT(*), 'keys must not be null') AS no_null_keys,
  assert_true(MIN(IDENTIFIER(:value_column)) >= 0, 'values must not be negative') AS non_negative
FROM IDENTIFIER(:catalog || '.' || :schema || '.' || :output_table);

-- Run these twice against the guide schema: once as yourself, then after switching to the
-- `account users` role (workspace menu, then the role). The text is identical; the results differ.
-- Replace <catalog>.<schema> with the guide schema.
SELECT session_user() AS session_user, current_user() AS current_user, is_member('admins') AS is_admin;

SELECT count(*) AS customers_visible, collect_set(region) AS regions FROM <catalog>.<schema>.customers;
SELECT count(*) AS orders_visible FROM <catalog>.<schema>.orders;
SELECT customer_id, email, national_id FROM <catalog>.<schema>.customers WHERE customer_id = 'CUST-000001';

-- Expected as `account users`: regions limited to the mapping table rows, email and national_id NULL,
-- restricted orders hidden. Expected as an admin: every row and the real values.
-- Policies branch on session_user() first. While a role is assumed, is_member('admins') is false
-- and a group is not a member of itself, so is_member('account users') is false too.

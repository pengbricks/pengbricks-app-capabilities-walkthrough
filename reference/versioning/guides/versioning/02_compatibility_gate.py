# Databricks notebook source
# MAGIC %pip install -q -r ../../requirements.txt

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC # 2. Compatibility gate
# MAGIC
# MAGIC Fails when a contract change is mislabeled by its version bump. Part 1 checks every consecutive pair of published contracts. Part 2 is a dry run: it relabels the breaking v2.0.0 as a minor release and confirms the gate rejects it.

# COMMAND ----------

import sys, os
sys.path.insert(0, os.path.abspath("../../src"))
from guide_params import bundle_root, load_params
params = load_params(dbutils, "capability_guides_versioning_release", ['catalog', 'schema', 'use_case', 'release'])
ROOT = bundle_root()
SPEC_FILE = ROOT / "use_cases" / f"{params['use_case']}.yml"
CONTRACTS_DIR = ROOT / "contracts"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Part 1: check every published pair

# COMMAND ----------

from compatibility import CompatibilityError, check_contracts, parse_version, with_version
from versioning_common import contracts_for, load_spec

spec = load_spec(SPEC_FILE)
ordered = sorted(contracts_for(CONTRACTS_DIR, spec).values(), key=lambda c: parse_version(c["version"]))

failures = []
for old, new in zip(ordered, ordered[1:]):
    result = check_contracts(old, new)
    print(f"GATE {result.old_version} -> {result.new_version}: {result.classification}, "
          f"required bump {result.required_bump}, {'PASS' if result.ok else 'FAIL'}")
    for change in result.changes:
        print(f"    {change.classification:<11} {change.kind:<20} {change.detail}")
    failures.extend(result.errors)
if failures:
    raise Exception("compatibility gate failed: " + "; ".join(failures))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Part 2: the gate rejects a mislabeled release
# MAGIC
# MAGIC The same breaking change published as 1.2.0 must be rejected.

# COMMAND ----------

old, breaking = ordered[-2], ordered[-1]
mislabeled = with_version(breaking, "1.2.0")
rejected = check_contracts(old, mislabeled)
print(f"DRY RUN {old['version']} -> 1.2.0 (really {breaking['version']}): "
      f"{'REJECTED' if not rejected.ok else 'ACCEPTED'}")
for error in rejected.errors:
    print(f"    {error}")
if rejected.ok:
    raise CompatibilityError("the gate accepted a breaking change labeled as a minor release")
print("Gate verified: real releases pass, the mislabeled release is rejected.")

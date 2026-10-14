"""Fail the job when a contract change is mislabeled by its version bump.

Part 1 checks every consecutive pair of published contracts. Part 2 is a logged dry run: it
relabels the breaking v2.0.0 as a minor release and confirms the gate rejects it.
"""

from __future__ import annotations

from versioning_common import contracts_for, load_spec, parse_args


def main() -> None:
    args = parse_args(need_uc=False)
    from compatibility import CompatibilityError, check_contracts, parse_version, with_version

    spec = load_spec(args.use_case_file)
    ordered = sorted(contracts_for(args, spec).values(), key=lambda c: parse_version(c["version"]))

    failures = []
    for old, new in zip(ordered, ordered[1:]):
        result = check_contracts(old, new)
        print(f"GATE {result.old_version} -> {result.new_version}: {result.classification}, "
              f"required bump {result.required_bump}, {'PASS' if result.ok else 'FAIL'}")
        for change in result.changes:
            print(f"    {change.classification:<11} {change.kind:<20} {change.detail}")
        failures.extend(result.errors)
    if failures:
        raise SystemExit("compatibility gate failed: " + "; ".join(failures))

    # Negative check: the same breaking change published as 1.2.0 must be rejected.
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


if __name__ == "__main__":
    main()

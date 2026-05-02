#!/usr/bin/env python3
"""
Agent Buccet Bootcamp — 14-Case Proof Harness
===============================================
Runs all 14 user-command-fidelity failure modes as deterministic proof cases.

Usage:
  python demo.py                            # Buccet mode, all 14 cases
  python demo.py --case 3                   # Buccet mode, single case
  python demo.py --unsafe-no-buccet         # Unsafe mode, all 14 cases
  python demo.py --unsafe-no-buccet --case 3
  python verify_ledger.py                   # Verify hash chain

No external dependencies — pure Python stdlib.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

LEDGER_PATH = OUTPUT_DIR / "ledger.jsonl"
UPL_RULES_PATH = ROOT / "upl_rules.json"

from buccet.ledger import append_entry  # noqa: E402
from tools.fake_fs import FakeFsTool  # noqa: E402
from tools.fake_comm import FakeCommTool  # noqa: E402
from tools.fake_network import FakeNetworkTool  # noqa: E402
from tools.fake_deploy import FakeDeployTool  # noqa: E402
from tools.fake_github import FakeGitHubTool  # noqa: E402
from tools.fake_spend import FakeSpendTool  # noqa: E402

import cases.case_01_ignore_instructions as c01
import cases.case_02_stale_instructions as c02
import cases.case_03_prompt_injection as c03
import cases.case_04_assumptions as c04
import cases.case_05_no_approval as c05
import cases.case_06_unnecessary_refusal as c06
import cases.case_07_wrong_task as c07
import cases.case_08_lost_context as c08
import cases.case_09_objective_drift as c09
import cases.case_10_format_violation as c10
import cases.case_11_scope_change as c11
import cases.case_12_hallucinated_completion as c12
import cases.case_13_constraint_violation as c13
import cases.case_14_data_leak as c14

ALL_CASES = [c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12, c13, c14]

TOOLS = {
    "fs":      FakeFsTool(),
    "comm":    FakeCommTool(),
    "network": FakeNetworkTool(),
    "deploy":  FakeDeployTool(),
    "github":  FakeGitHubTool(),
    "spend":   FakeSpendTool(),
}


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def _sep(title: str = "", width: int = 68) -> None:
    if title:
        pad = max(0, width - len(title) - 4)
        print(f"\n== {title} {'=' * pad}")
    else:
        print("=" * width)


def _load_upl() -> dict:
    with open(UPL_RULES_PATH) as f:
        return json.load(f)


def _expected_buccet_decision(case_mod) -> str:
    return getattr(case_mod, "EXPECTED_BUCCET_DECISION", "deny")


def _expected_unsafe_tool_called(case_mod) -> bool:
    return getattr(case_mod, "EXPECTED_UNSAFE_TOOL_CALLED", True)


def run_one(case_mod, unsafe: bool, upl_rules: dict) -> dict:
    """Run a single case, return a result summary dict."""
    mode = "unsafe" if unsafe else "buccet"
    cid  = case_mod.CASE_ID
    name = case_mod.CASE_NAME
    desc = case_mod.DESCRIPTION

    out_dir = OUTPUT_DIR / f"case-{cid:02d}"
    out_dir.mkdir(parents=True, exist_ok=True)

    packet = case_mod.build_packet()

    if unsafe:
        verdict, tool_result = case_mod.run_unsafe(packet, TOOLS)
    else:
        verdict, tool_result = case_mod.run_buccet(packet, upl_rules, TOOLS)

    verdict.update({"request_id": packet["request_id"], "session_id": packet["session_id"]})

    _write_json(out_dir / "agent_packet.json",      packet)
    _write_json(out_dir / "upl_snapshot.json",       upl_rules)
    _write_json(out_dir / "verdict_packet.json",     verdict)
    _write_json(out_dir / "tool_execution_log.json", {
        "case_id":     cid,
        "mode":        mode,
        "tool_called": tool_result is not None,
        "tool_result": tool_result,
    })

    ledger_entry, record_hash = append_entry(
        LEDGER_PATH, cid, name, mode, packet, verdict, tool_result
    )

    decision = verdict["decision"]
    tool_reached = tool_result is not None

    if unsafe:
        expected_ok = (tool_reached == _expected_unsafe_tool_called(case_mod))
    else:
        expected_ok = (decision == _expected_buccet_decision(case_mod))

    return {
        "case_id":       cid,
        "case_name":     name,
        "description":   desc,
        "mode":          mode,
        "decision":      decision,
        "tool_reached":  tool_reached,
        "law_triggered": (verdict.get("triggered_law_ids") or [None])[0],
        "denial_class":  verdict.get("denial_class"),
        "ledger_index":  ledger_entry["META"]["index"],
        "record_hash":   record_hash[:16] + "...",
        "pass":          expected_ok,
    }


def print_case_header(case_mod, unsafe: bool) -> None:
    mode_label = "UNSAFE (no Buccet)" if unsafe else "BUCCET (protected)"
    _sep(f"Case {case_mod.CASE_ID:02d}: {case_mod.CASE_NAME}  [{mode_label}]")
    print(f"  {case_mod.DESCRIPTION}")
    print()


def print_case_result(r: dict) -> None:
    tool_label = "TRUE" if r["tool_reached"] else "FALSE"
    pass_label  = "PASS" if r["pass"] else "FAIL"
    print()
    print(f"  Decision:     {r['decision'].upper()}")
    print(f"  Tool reached: {tool_label}")
    if r["law_triggered"]:
        print(f"  Law:          {r['law_triggered']}")
    if r["denial_class"]:
        print(f"  Class:        {r['denial_class']}")
    print(f"  Ledger:       entry #{r['ledger_index']}  hash={r['record_hash']}")
    print(f"  Result:       [{pass_label}]")


def run_all(unsafe: bool, case_filter: int | None) -> None:
    upl_rules = _load_upl()
    mode_label = "UNSAFE  (--unsafe-no-buccet)" if unsafe else "BUCCET  (protected)"

    _sep(f"AGENT BUCCET BOOTCAMP  —  {mode_label}")
    print(f"  14-case proof harness | mode={('unsafe' if unsafe else 'buccet')}")
    print()

    results = []
    for case_mod in ALL_CASES:
        if case_filter is not None and case_mod.CASE_ID != case_filter:
            continue
        print_case_header(case_mod, unsafe)
        r = run_one(case_mod, unsafe, upl_rules)
        print_case_result(r)
        results.append(r)

    if not results:
        print(f"No case with id={case_filter}")
        sys.exit(1)

    if case_filter is not None:
        return

    _sep("FINAL PROOF SUMMARY")
    passing = sum(1 for r in results if r["pass"])
    failing = sum(1 for r in results if not r["pass"])

    denied_but_tool_reached = [
        r for r in results
        if not unsafe
        and r["decision"] not in ("allow", "bypassed", "self_refused")
        and r["tool_reached"]
    ]

    print()
    print(f"  Mode:                    {'unsafe' if unsafe else 'buccet'}")
    print(f"  Cases run:               {len(results)}")
    print(f"  Passing:                 {passing}")
    print(f"  Failing:                 {failing}")
    print()

    if unsafe:
        tool_called_count = sum(1 for r in results if r["tool_reached"])
        print(f"  Tool executions:         {tool_called_count} / {len(results)}")
        print(f"  (Unsafe shows bad consequences that Buccet prevents)")
    else:
        denied_count = sum(
            1 for r in results
            if r["decision"] not in ("allow",)
        )
        allowed_count = sum(1 for r in results if r["decision"] == "allow")
        print(f"  Actions blocked/asked:   {denied_count}")
        print(f"  Actions allowed:         {allowed_count}  (case 6: overbroad refusal overridden)")
        print(f"  Denied actions that reached tool: {len(denied_but_tool_reached)}")

    print()
    print(f"  Ledger:  output/ledger.jsonl  ({len(results)} entries)")
    print(f"  Verify:  python verify_ledger.py")
    print()

    for r in results:
        icon = "✓" if r["pass"] else "✗"
        tool_str = "tool=YES" if r["tool_reached"] else "tool=NO "
        print(f"  {icon} Case {r['case_id']:02d}  {tool_str}  {r['decision']:<22}  {r['case_name']}")

    print()

    all_pass = (failing == 0 and len(denied_but_tool_reached) == 0)

    if all_pass:
        _sep()
        print()
        print("  RESULT: PASS")
        if not unsafe:
            print("  All 14 Buccet decisions correct.")
            print("  0 denied actions reached tools.")
        else:
            print("  All 14 unsafe consequences demonstrated.")
        print()
        _sep()
    else:
        _sep()
        print()
        print("  RESULT: FAIL")
        if denied_but_tool_reached:
            print(f"  {len(denied_but_tool_reached)} denied action(s) incorrectly reached tool.")
        if failing:
            print(f"  {failing} case(s) produced unexpected decision.")
        print()
        _sep()
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Agent Buccet Bootcamp — 14-Case Proof Harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python demo.py                            # Buccet mode, all 14 cases
  python demo.py --case 3                   # Buccet mode, single case
  python demo.py --unsafe-no-buccet         # Unsafe mode, all 14 cases
  python demo.py --unsafe-no-buccet --case 5
  python verify_ledger.py                   # Verify hash chain
""",
    )
    parser.add_argument(
        "--unsafe-no-buccet",
        action="store_true",
        default=False,
        help="Bypass Buccet law — demonstrate bad consequences.",
    )
    parser.add_argument(
        "--case",
        type=int,
        default=None,
        metavar="N",
        help="Run a single case by number (1–14). Omit for all 14.",
    )
    args = parser.parse_args()

    if LEDGER_PATH.exists() and args.case is None:
        LEDGER_PATH.unlink()

    run_all(unsafe=args.unsafe_no_buccet, case_filter=args.case)

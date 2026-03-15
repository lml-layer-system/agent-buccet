# Coding Failure Periodic Table Coverage Report

## Scope
- source: /Users/ryangatoloai-faupula/Desktop/INFINITE TO FINITE EFUE ✅ 2/CODING_FAILURE_PERIODIC_TABLE.md
- explicit leaf classes parsed: 117
- note: this report only scores explicit leaf classes present in the current markdown file; placeholder groups not expanded in the file are not counted as leaves here.

## Summary
- direct: 24
- subsumed: 93
- uncovered: 0

## By Dimension
- A: direct=7, subsumed=0, uncovered=0
- C: direct=0, subsumed=3, uncovered=0
- F: direct=3, subsumed=0, uncovered=0
- G: direct=3, subsumed=0, uncovered=0
- I: direct=3, subsumed=0, uncovered=0
- L: direct=7, subsumed=42, uncovered=0
- S: direct=1, subsumed=48, uncovered=0

## Direct Coverage
- S1.2 WRONG LANGUAGE TOKENS: Directly caught by language-surface and cross-language contamination checks.
- L7.1 UNINITIALIZED VARIABLE: Directly caught by uninitialized variable state validation.
- L7.2 RACE CONDITION: Directly caught by race-condition state validation.
- L7.3 DEADLOCK: Directly caught by deadlock state validation.
- L7.4 STATE INCONSISTENCY: Directly caught by state inconsistency validation.
- L7.5 GLOBAL STATE POLLUTION: Directly caught by global state pollution validation.
- L7.6 STALE STATE: Directly caught by stale state validation.
- L7.7 MISSING STATE RESET: Directly caught by missing state reset validation.
- A1.1 TIGHT COUPLING: Directly caught by tight-coupling design validation.
- A1.2 GOD OBJECT: Directly caught by god-object design validation.
- A1.3 CIRCULAR DEPENDENCY: Directly caught by circular dependency architecture validation.
- A1.4 FEATURE ENVY: Directly caught by feature-envy design validation.
- A1.5 INAPPROPRIATE INTIMACY: Directly caught by inappropriate-intimacy design validation.
- A1.6 MESSAGE CHAIN: Directly caught by message-chain design validation.
- A1.7 MIDDLE MAN: Directly caught by middle-man design validation.
- G1.1 WRONG TIME COMPLEXITY: Directly caught by wrong-time-complexity scale validation.
- G1.2 EXPONENTIAL WHEN POLYNOMIAL EXISTS: Directly caught by exponential-growth scale validation.
- G1.3 DOESN'T SCALE: Directly caught by non-scaling query/app shape validation.
- F1.1 SQL INJECTION: Directly caught by SQL injection security validator.
- F1.2 XSS VULNERABILITY: Directly caught by XSS security validator.
- F1.3 HARDCODED CREDENTIALS: Directly caught by hardcoded credentials security validator.
- I1.1 VERSION MISMATCH: Directly caught by dependency version mismatch validation.
- I1.2 MISSING DEPENDENCY: Directly caught by missing dependency validation.
- I1.3 TRANSITIVE DEPENDENCY CONFLICT: Directly caught by transitive dependency conflict validation.

## Uncovered Leaf Classes

## Read
- `direct` means there is an explicit validator or law path for the named leaf class.
- `subsumed` means the current law stack catches the class through a stronger generalized validator, but not by leaf-specific naming.
- `uncovered` means the current system should not claim that leaf class is structurally closed yet.

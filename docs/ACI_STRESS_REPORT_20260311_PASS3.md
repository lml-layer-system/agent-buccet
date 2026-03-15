# ACI Stress Report

Date: `2026-03-11`
Pass: `3`
Status: `After capability overcapture and deterministic-mouth fixes`

## Delta From Prior Pass

Two targeted fixes were applied:
- `capabilities` path now only triggers on pure capability questions
- mixed human / multi-domain prompts no longer default to `coding.blocked`

## Improvement

Observed totals from the 10-prompt pack:
- `success`: `3` (up from `2` in the previous pass if counting admitted paths before fallback collapse; still only `2` with useful emitted content)
- `coding.blocked`: `1` (down from `5`)
- `chat.governed`: `9` (up from `5`)
- wrong stock capability answer: `0` (down from `2`)

## What improved

1. mixed prompts now stay in branch formation
- P01, P03, P04, P06, P08 all moved out of `coding.blocked`
- this is the correct architectural direction

2. the wrong deterministic capability mouth is gone
- the repeated `I can ingest docs into LML laws...` answer disappeared from admitted branch paths

## What is now the dominant gap

### 1. Parent lock brittleness is now the biggest issue
Many lawful prompts now reach `chat.governed` and then fail here:
- `nocr_parent_lock_miss`
- `lock_reason_class=no_extracted_root_match`

This now affects:
- P01
- P03
- P04
- P05
- P06
- P08

Engineering read:
- the system is no longer being hijacked early by ability routing
- it is now revealing the true next bottleneck: parent/root meeting under messy human and mixed-domain prompts

### 2. GPT-2 timeout is now visible on admitted branches
Admitted branches on:
- P07
- P09

both timed out with:
- `generation_status=fallback`
- `generation_failure_class=timeout`

Engineering read:
- branch formation improved enough that renderer timeout is now showing up more clearly
- this is useful signal, not regression

### 3. Human leak gate still false-positives
P02 still fails with:
- `NSL human mirror gate forced NULL: internal_system_leak`

### 4. Relevance gate still overkills valid meta prompt
P10 still fails with:
- `NSL relevance gate forced NULL: low_query_response_relevance`

## Current exact priority order

1. harden parent/root meeting for human and mixed prompts
2. soften false-positive `internal_system_leak`
3. retune relevance gate against admitted branch structure
4. reduce renderer timeout pressure on admitted branches

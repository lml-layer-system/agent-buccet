# UPL Acceptance Source Pipeline

This is the repeatable yes-side intake path.

It is for users who want to browse external skill catalogs, choose the skill or
workflow they want, paste raw source material into the UPL acceptance side,
sync it, and keep doing that as long as they want.

This is still the same Buccet acceptance-side UPL.

- source catalogs stay open-ended
- Buccet acceptance stays the finite compiled result
- denial still overrides acceptance on overlap

The same raw-source intake parser also works in the denial lane.
If you paste the same material into `~/.buccet/upl-docs/denial` and run
`buccet upl sync --lane denial`, Buccet compiles it into denied UPL instead.

If you want the shortest single-place operator map for UPL lanes, path sources,
and scope, run `buccet where`.

## Source catalogs

- [SkillsMP](https://skillsmp.com) — largest broad skill catalog
- [AITmpl Skills](https://aitmpl.com/skills) — templates and one-command install workflows
- [SkillHub](https://skillhub.club) — AI-rated skills and high-signal curation
- [AgentSkills](https://agentskills.io) — official spec and shape grounding

## Fast pipeline

1. Open one of the source catalogs above and choose the skill or workflow you want.
   Fast opener:
   - `buccet upl sources --open skillsmp`
   - `buccet upl sources --open aitmpl`
   - `buccet upl sources --open skillhub`
   - `buccet upl sources --open agentskills`
2. Copy the raw source material you care about.
   That can be:
   - source text or summary
   - `SKILL.md`
   - `README.md`
   - extracted package markdown
3. Open your authored acceptance lane:

```text
~/.buccet/upl-docs/acceptance
```

4. Either paste directly into a new markdown file, or copy the intake template into one:

```bash
cp ~/.buccet/upl-docs/acceptance/SKILL_INTAKE_TEMPLATE.txt ~/.buccet/upl-docs/acceptance/my-skill.md
```

5. Paste the copied source material into that markdown file.
6. Compile it into the live yes side:

```bash
buccet upl sync --lane acceptance
```

If you forget, Buccet auto-syncs changed UPL docs before runtime surfaces like
`buccet console`, `buccet run`, `buccet hook run`, and `buccet path run`.

7. Inspect what landed:

```bash
buccet upl search my-skill
buccet upl diff --search my-skill
buccet upl show <upl-id>
```

Buccet parses raw source material into bounded acceptance-side UPL.

The user does not have to hand-write the law just to get the intake through.
If the file is already authored UPL law, Buccet keeps using the strict law parser first.

## Template shape

The built-in intake template uses this shape:

```md
# <skill-or-workflow-name>

## Source material
Catalog: <SkillsMP | AITmpl Skills | SkillHub | AgentSkills>
URL: <paste source URL here>
Copied text:
Paste the skill or workflow description here.
```

## Parse rule

What parses reliably:

- real skill or workflow source text
- real `SKILL.md` content
- real `README.md` content
- extracted package markdown
- real capability summaries
- real examples and normal usage text
- low-hype descriptions of what the thing actually does

What does not parse reliably:

- pure hype with no real capability meaning
- decorative filler with no real work surface
- empty templates with no copied source text

Keep summaries tied to observable capability text rather than prose-only hype. Authoring rules are exercised by UPL governance contracts and regeneration scripts checked into this repo.

## Why this exists

This keeps the yes side open without turning it into tool soup.

The user can:

- browse any of the upstream catalogs
- choose whatever they want
- turn it into authored acceptance-side law
- compile it into the same live Buccet UPL field
- inspect, mute, remove, or replace it later

That is the whole pipeline.

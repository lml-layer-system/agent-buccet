import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  REMOTE_LLM_ACCEPTANCE_CORRIDORS,
  LOCAL_LLM_ACCEPTANCE_CORRIDORS,
} from "../lib/agent-buccet/agent-comprehension-acceptance.ts";
import { buildBaseAcceptanceSeeds } from "../lib/agent-buccet/base-upl-acceptance.ts";
import {
  REMOTE_LLM_PROVIDER_DEFAULTS,
  LOCAL_LLM_PROVIDER_DEFAULTS,
  addTeamLocalLlmSource,
  addTeamRemoteLlmSource,
  addTeamSource,
  createTeam,
  loadTeam,
  teamSlug,
} from "../lib/agent-buccet/team-workshop.ts";

/**
 * Path-Source Library Contract.
 *
 * Verifies the unified path-source transport substrate:
 *   - file        : on-disk markdown / code / json
 *   - remote-llm  : remote inference endpoints (Pi, OpenAI, Anthropic, ...)
 *   - local-llm   : local inference runtimes (Ollama, llama.cpp, LM Studio, ...)
 *
 * Three things must be true for the library to be Buccet-governed:
 *   1) The team manifest stores transport + provider config but NEVER the auth key.
 *   2) The base UPL acceptance pack contains a NAMED corridor for every provider
 *      we ship by default — remote providers as `network.send`, local providers
 *      as `tool.exec`. This is what makes "100% governed by Buccet" structurally
 *      true: every source call has a verdict before it leaves.
 *   3) An unknown remote endpoint is NOT covered by any of the seeded corridors —
 *      operators add it explicitly through the standard UPL flow.
 */

async function main(): Promise<void> {
  console.log("--- Agent Buccet Path-Source Library Contract ---");
  const home = await mkdtemp(path.join(tmpdir(), "buccet-library-contract-"));
  try {
    const slug = teamSlug("library-contract-team");
    await createTeam({ homePath: home, name: "library-contract-team", domain: "contract", summary: "library contract" });

    // ----- 1. File transport (backward-compat) -----------------------------
    const fileSrc = path.join(home, "voice.md");
    await writeFile(fileSrc, "# Brand voice\n", "utf8");
    await addTeamSource({ homePath: home, slug, filePath: fileSrc, kind: "file:md" });

    // ----- 2. Remote-LLM transport (Anthropic) -----------------------------
    await addTeamRemoteLlmSource({ homePath: home, slug, provider: "anthropic" });

    // ----- 3. Local-LLM transport (Ollama) ---------------------------------
    await addTeamLocalLlmSource({ homePath: home, slug, provider: "ollama", model: "llama3:8b" });

    const manifest = await loadTeam(home, slug);
    assert.ok(manifest, "team manifest must be loadable after registrations");

    const corpus = manifest.pathSourceCorpus;
    const fileSource = corpus.find((s) => s.kind === "file:md");
    const aiSource = corpus.find((s) => s.transport === "remote-llm" && s.remote?.provider === "anthropic");
    const ollamaSource = corpus.find((s) => s.transport === "local-llm" && s.local?.provider === "ollama");

    assert.ok(fileSource, "file transport source must persist");
    assert.ok(aiSource, "remote-llm:anthropic source must persist");
    assert.ok(ollamaSource, "local-llm:ollama source must persist");

    // Auth key must NEVER be stored — only the env-var name.
    assert.equal(aiSource!.remote!.authEnvVar, "ANTHROPIC_API_KEY", "Anthropic source must carry the env-var name only");
    const aiJson = JSON.stringify(aiSource);
    assert.ok(!/sk-ant-/i.test(aiJson), "remote source manifest must not contain key-like material");
    assert.ok(!/Bearer/i.test(aiJson), "remote source manifest must not contain bearer header material");

    // Endpoint defaults populate when not overridden.
    assert.equal(aiSource!.remote!.endpoint, REMOTE_LLM_PROVIDER_DEFAULTS.anthropic.endpoint, "Anthropic default endpoint must apply");
    assert.equal(ollamaSource!.local!.endpoint, LOCAL_LLM_PROVIDER_DEFAULTS.ollama.endpoint, "Ollama default endpoint must apply");

    console.log("SUCCESS: file, remote-llm, and local-llm transports all persist with no key material.");

    // ----- 4. Base UPL acceptance pack contains a named corridor per provider
    const seeds = buildBaseAcceptanceSeeds({
      rootPath: home,
      grantedActions: [
        "fs.read",
        "fs.write",
        "fs.delete",
        "network.send",
        "tool.exec",
        "agent.spend",
        "chat.emit",
      ],
    });

    for (const corridor of REMOTE_LLM_ACCEPTANCE_CORRIDORS) {
      const lane = seeds.find((s) => s.id === corridor.id);
      assert.ok(lane, `expected base UPL seed for remote provider corridor ${corridor.id}`);
      assert.deepEqual(
        lane!.actionKinds,
        ["network.send"],
        `${corridor.id} must gate on network.send`,
      );
      assert.equal(lane!.acceptanceClass, "agent_comprehension", `${corridor.id} must be in the agent_comprehension class`);
    }

    for (const corridor of LOCAL_LLM_ACCEPTANCE_CORRIDORS) {
      const lane = seeds.find((s) => s.id === corridor.id);
      assert.ok(lane, `expected base UPL seed for local provider corridor ${corridor.id}`);
      assert.deepEqual(
        lane!.actionKinds,
        ["tool.exec"],
        `${corridor.id} must gate on tool.exec`,
      );
      assert.equal(lane!.targetPattern, corridor.binary, `${corridor.id} must target binary "${corridor.binary}"`);
      assert.equal(lane!.acceptanceClass, "agent_comprehension", `${corridor.id} must be in the agent_comprehension class`);
    }

    console.log("SUCCESS: every shipped provider has a named UPL corridor (remote=network.send, local=tool.exec).");

    // ----- 5. Unknown remote endpoints are NOT covered ---------------------
    const unknownHost = "https://api.unknown-llm.example.com/v1/chat";
    const matches = seeds.filter((s) => {
      if (s.acceptanceClass !== "agent_comprehension") return false;
      if (!s.actionKinds.includes("network.send")) return false;
      if (s.targetMatchMode !== "regex") return false;
      const pattern = s.targetPattern;
      if (typeof pattern !== "string" || pattern.length === 0) return false;
      const inner = pattern.replace(/^\/(.*)\/[a-z]*$/, "$1");
      return new RegExp(inner, "i").test(unknownHost);
    });
    assert.equal(matches.length, 0, "an unknown remote endpoint must NOT match any shipped corridor — operator must add it explicitly");
    console.log("SUCCESS: unknown remote endpoints are not silently allowed; operator must opt them in.");

    console.log("\n--- Path-Source Library Contract Verified ---");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

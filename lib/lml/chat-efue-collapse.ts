import { createHash } from "node:crypto";
import type { SeedChild } from "@/lib/nocr/types";
import type { ChatConvoPossibility } from "@/lib/lml/chat-convo-qe";

export type ChatEfueCollapseResult = {
  finiteSeedCount: number;
  seeds: SeedChild[];
};

export function collapseChatConvoPossibilities(possibilities: ChatConvoPossibility[]): ChatEfueCollapseResult {
  const seeds = possibilities
    .slice()
    .sort((a, b) => b.amplitude - a.amplitude)
    .slice(0, 8)
    .map((possibility, index) => materializeChatConvoSeed(possibility, index));

  return {
    finiteSeedCount: seeds.length,
    seeds,
  };
}

function materializeChatConvoSeed(possibility: ChatConvoPossibility, rank: number): SeedChild {
  const digest = createHash("sha256").update(`${possibility.origin}:${possibility.text}`).digest("hex").slice(0, 12);
  return {
    id: `seed.chat_convo.${digest}`,
    source: "chat",
    text: possibility.text,
    abilityRoute: "chat.governed",
    origin: mapOrigin(possibility.origin),
    rank,
  };
}

function mapOrigin(origin: ChatConvoPossibility["origin"]): SeedChild["origin"] {
  switch (origin) {
    case "quantum_spark.chat_register":
      return "quantum_spark.chat_register";
    case "quantum_spark.chat_rhythm":
      return "quantum_spark.chat_rhythm";
    case "quantum_spark.chat_affect":
      return "quantum_spark.chat_affect";
    case "quantum_spark.chat_distance":
      return "quantum_spark.chat_distance";
    case "quantum_spark.chat_guidance":
      return "quantum_spark.chat_guidance";
    case "quantum_spark.chat_distress":
      return "quantum_spark.chat_distress";
  }
}

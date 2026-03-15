// Normalized source set. Inventory-only until explicitly promoted into active enforcement.
// Derived from:
// - QUANTUM_FIXED_POINT 2.md
// - COMPLETE_QUANTUM_ENUMERATION.md
// - lml quantum projection .txt
// - quantum lml add properly.txt

export const QUANTUM_PLANET_LAWS = [
  "QUANTUM.01: Quantum behavior is governed by finite generative rules rather than primitive infinite structure.",
  "QUANTUM.02: Every admissible quantum state must classify into a finite state-structure class.",
  "QUANTUM.03: Every admissible quantum evolution must classify into a finite evolution-type class.",
  "QUANTUM.04: Superposition expresses open possibility within finite state rules rather than exempting the system from structure.",
  "QUANTUM.05: Measurement projects open superposition into finite outcome classes and is the primary collapse force in the system.",
  "QUANTUM.06: Basis choice changes measurement statistics and therefore observed outcome structure depends on the measurement frame.",
  "QUANTUM.07: Relative phase can alter interference behavior without necessarily changing direct measurement probabilities in a fixed basis.",
  "QUANTUM.08: Product states and entangled states are distinct separability classes and must not be conflated.",
  "QUANTUM.09: Controlled operations lawfully create or manipulate entanglement across multi-state systems.",
  "QUANTUM.10: Decoherence converts pure-state behavior toward mixed-state or pointer-state behavior under environment interaction.",
  "QUANTUM.11: Pointer states are decoherence-stable survivors that explain classical-like persistence.",
  "QUANTUM.12: Unitary evolution preserves norm while measurement is non-unitary and probabilistic.",
  "QUANTUM.13: Quantum errors are finite evolution failure classes and require explicit correction handling.",
  "QUANTUM.14: Finite fixed points are found by colliding open state-generation capacity with finite measurement and constraint forces.",
  "QUANTUM.15: Quantum interpretation inside LML should favor collapse, admissibility, and class structure over mystification language.",
] as const;

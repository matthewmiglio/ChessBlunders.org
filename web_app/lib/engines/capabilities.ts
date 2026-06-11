export interface Capabilities {
  crossOriginIsolated: boolean;
  wasmSimd: boolean;
  hardwareConcurrency: number;
  threads: number;
}

let cached: Capabilities | null = null;

const SIMD_PROBE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60,
  0x00, 0x01, 0x7b, 0x03, 0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00,
  0x41, 0x00, 0xfd, 0x0f, 0xfd, 0x62, 0x0b,
]);

export function detectCapabilities(): Capabilities {
  if (cached) return cached;

  const coi =
    typeof globalThis !== "undefined" &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;

  let simd = false;
  try {
    simd = WebAssembly.validate(SIMD_PROBE);
  } catch {
    simd = false;
  }

  const hc =
    typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency
      : 4;

  const threads = coi ? Math.max(1, Math.min(hc - 1, 8)) : 1;

  cached = { crossOriginIsolated: coi, wasmSimd: simd, hardwareConcurrency: hc, threads };
  return cached;
}

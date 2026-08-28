/**
 * Fetch a WASM module as a `Response` with a guaranteed
 * `application/wasm` content type.
 *
 * Reads the whole payload before handing it over: long-lived streaming reads
 * are fragile across some hosts and proxies (mid-stream truncations used to
 * abort compilation with a cryptic "Failed to read from a ReadableStream"),
 * and forcing the MIME type keeps `WebAssembly.compileStreaming` happy on
 * hosts that serve `.wasm` as `application/octet-stream`. Transport-level
 * compression stays intact – we never decompress manually here.
 */

export async function fetchWasmResponse(url: string): Promise<Response> {
  const load = async (): Promise<Response> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const buffer = await res.arrayBuffer();
    return new Response(buffer, { headers: { 'Content-Type': 'application/wasm' } });
  };
  try {
    return await load();
  } catch {
    // One retry for transient network failures.
    return await load();
  }
}

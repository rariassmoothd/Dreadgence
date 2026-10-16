(() => {
  window.installDreadgenceDataChunks = (dataUrl, parts, totalBytes, onFailure) => {
    const target = new URL(dataUrl, document.baseURI).href;
    const originalFetch = window.fetch.bind(window);
    const stats = window.dreadgenceChunkDownload = { completed: 0, bytes: 0, totalBytes };
    window.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, document.baseURI).href;
      if (url !== target) return originalFetch(input, options);
      let index = 0;
      const body = new ReadableStream({
        async pull(controller) {
          if (index === parts.length) { controller.close(); return; }
          const part = parts[index++];
          try {
            const response = await originalFetch(new URL(part.path, document.baseURI).href, { signal: options.signal, cache: 'default' });
            if (!response.ok) throw new Error(`${part.path}: HTTP ${response.status}`);
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.byteLength !== part.bytes) throw new Error(`${part.path}: expected ${part.bytes} bytes, received ${bytes.byteLength}; check for Git LFS pointers or incomplete upload`);
            if (globalThis.crypto?.subtle) {
              const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
              if (hash !== part.sha256) throw new Error(`${part.path}: SHA-256 mismatch`);
            }
            stats.completed++;
            stats.bytes += bytes.byteLength;
            controller.enqueue(bytes);
          } catch (error) { onFailure(error); controller.error(error); }
        }
      });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(totalBytes) } });
    };
  };
})();

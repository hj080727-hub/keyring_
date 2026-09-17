// Cloudflare Worker — keep OPENAI_API_KEY in a Worker Secret, never in GitHub Pages.
// POST JSON: { image: "data:image/...;base64,...", mode: "cutout" | "line" }

const MODEL = "gpt-image-2.5-sunburst";

function dataUrlToBlob(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Invalid image data URL');
  const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  return new Blob([bytes], { type: m[1] || 'image/png' });
}

function cors(headers = {}) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors() });

    try {
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
      const body = await request.json();
      const image = dataUrlToBlob(body.image);
      const mode = body.mode === 'line' ? 'line' : 'cutout';

      const prompt = mode === 'cutout'
        ? 'Edit this exact character image for a keyring product. Preserve the character, face, clothing, colors, proportions, pose, and all meaningful artwork details as faithfully as possible. Remove ONLY the background and make the background fully transparent. Do not redesign, redraw, beautify, add, or remove any part of the character. Keep fine hair and small details. Output a clean transparent PNG.'
        : 'Edit this exact character image into clean printable line art for a transparent acrylic keyring. Preserve the exact silhouette, pose, clothing structure, facial features, hair shape, and important details. Use crisp monochrome dark lines on a fully transparent background. Do not invent details, do not change the character design, and do not add shading or a colored background.';

      const form = new FormData();
      form.append('model', MODEL);
      form.append('image', image, 'character.png');
      form.append('prompt', prompt);
      form.append('background', 'transparent');
      form.append('output_format', 'png');
      form.append('quality', 'medium');
      form.append('size', '1024x1024');

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: form,
      });

      const data = await response.json();
      if (!response.ok) {
        return new Response(JSON.stringify({ error: data?.error?.message || 'OpenAI image edit failed' }), {
          status: response.status, headers: cors({ 'Content-Type': 'application/json' })
        });
      }

      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) throw new Error('No image returned by OpenAI');
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return new Response(bytes, { headers: cors({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }) });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message || 'Worker error' }), {
        status: 500, headers: cors({ 'Content-Type': 'application/json' })
      });
    }
  }
};

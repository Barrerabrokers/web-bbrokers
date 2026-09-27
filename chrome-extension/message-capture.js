// Read only messages rendered in the open conversation. Never read the compose box.
(() => {
  const rowSelector = '[data-testid^="conv-msg-"], .message-in, .message-out';
  function rows(main) {
    return Array.from(main?.querySelectorAll(rowSelector) || []).filter(row => !row.parentElement?.closest(rowSelector));
  }
  function read(main) {
    const items = rows(main);
    const senders = new Map();
    const describe = row => {
      const content = row.querySelector('[data-pre-plain-text]');
      const timestamp = content?.getAttribute('data-pre-plain-text') || '';
      const sender = timestamp.replace(/^\[[^\]]+\]\s*/, '').replace(/:\s*$/, '').trim();
      const labels = Array.from(row.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label').trim());
      const pending = row.querySelector('[data-icon="msg-time"], [data-icon="msg-error"]') || labels.some(label => /^(pendiente|enviando|no enviado|pending|sending|failed)(\b|$)/i.test(label));
      let direction = row.classList.contains('message-out') || row.querySelector('[data-icon="tail-out"], [data-testid="tail-out"]') || labels.some(label => /^(tú:|you:|enviado|entregado|leído|sent|delivered|read)$/i.test(label)) ? 'outbound' : row.classList.contains('message-in') || row.querySelector('[data-icon="tail-in"], [data-testid="tail-in"]') ? 'inbound' : '';
      if (sender && direction) senders.set(sender, direction);
      return { row, content, timestamp, sender, direction, pending };
    };
    const described = items.map(describe);
    return described.flatMap(({ row, content, timestamp, sender, direction, pending }) => {
      direction ||= senders.get(sender) || '';
      // Modern outgoing bubbles expose delivery metadata, including grouped bubbles.
      if (!direction && content && !row.querySelector('[data-testid="msg-meta"][role="button"]')) direction = 'inbound';
      const id = row.getAttribute('data-id') || row.closest('[data-id]')?.getAttribute('data-id') || row.querySelector('[data-id]')?.getAttribute('data-id');
      if (!id || !direction || pending) return [];
      const texts = Array.from((content || row).querySelectorAll('.selectable-text, [data-testid="selectable-text"]'));
      const text = texts.filter(el => !texts.some(other => other !== el && other.contains(el))).map(el => el.innerText || el.textContent || '').join('\n').trim();
      const media = row.querySelector('audio, [data-icon*="audio"], [data-icon*="ptt"]') ? '[Audio: archivo no copiado desde WhatsApp Web]' : row.querySelector('[data-icon*="document"]') ? '[Documento adjunto: archivo no copiado desde WhatsApp Web]' : row.querySelector('img[src^="blob:"], video') ? '[Imagen o video: archivo no copiado desde WhatsApp Web]' : '';
      const body = [text, media].filter(Boolean).join('\n');
      if (!body) return [];
      return [{ id, direction, text: body.slice(0, 20000), timestamp: timestamp.slice(0, 200) }];
    });
  }
  globalThis.BBMessageCapture = { read, rows };
})();

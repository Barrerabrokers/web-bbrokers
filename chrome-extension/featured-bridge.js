/* Operates only WhatsApp's public list controls; never touches its chat store or virtual rows. */
(() => {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const validPhone = value => /^\d{10,15}$/.test(value);
  const canonical = value => String(value).replace(/\D/g, '').replace(/^549/, '54');
  function featuredPlan({ members, leads, featured, phone, fullName }) {
    const starred = new Set(featured.map(String)), operations = new Map(), unresolved = [];
    for (const lead of leads) {
      const number = phone(lead);
      if (starred.has(String(lead.id))) {
        if (!validPhone(number)) { unresolved.push(fullName(lead)); continue; }
        operations.set(number, { phone: number, add: true, importIds: [] });
      }
    }
    for (const name of members) {
      const numeric = /^[+\d\s()-]+$/.test(name);
      const matches = leads.filter(lead => numeric ? canonical(phone(lead)) === canonical(name) : normalize(fullName(lead)) === normalize(name));
      if (matches.length !== 1 || !validPhone(phone(matches[0]))) { unresolved.push(name); continue; }
      const lead = matches[0], number = phone(lead);
      if (leads.filter(other => canonical(phone(other)) === canonical(number)).length !== 1) { unresolved.push(name); continue; }
      if (starred.has(String(lead.id))) continue;
      const operation = operations.get(number) || { phone: number, add: false, importIds: [] };
      if (!operation.importIds.includes(lead.id)) operation.importIds.push(lead.id);
      operations.set(number, operation);
    }
    return { operations: [...operations.values()], unresolved };
  }
  class NativeLists {
    constructor({ storage, report }) { this.storage = storage; this.report = report; this.busy = false; this.cancelled = false; }
    cancel() { this.cancelled = true; }
    check() { if (this.cancelled) throw new Error('Vinculación cancelada. Los cambios pendientes de WhatsApp no se guardaron.'); }
    visible(el) {
      if (!el || el.closest('#bb-crm-extension-root') || !el.getClientRects().length) return false;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2)), Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2)));
      return hit && (el.contains(hit) || hit.contains(el));
    }
    label(el) {
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
      const clone = el.cloneNode(true);
      clone.querySelectorAll('img[alt]').forEach(img => img.replaceWith(document.createTextNode(img.alt))); 
      clone.querySelectorAll('svg, [aria-hidden="true"]').forEach(node => node.remove());
      return clone.textContent.trim();
    }
    find(selector, text, scope = document) {
      return [...scope.querySelectorAll(selector)].find(el => this.visible(el) && (text === undefined || this.label(el) === text));
    }
    button(text, scope = document) { return this.find('button, [role="button"]', text, scope); }
    async wait(get, description, timeout = 8000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) { this.check(); const result = get(); if (result) return result; await pause(120); }
      throw new Error(`No se pudo ${description}. Volvé a Chats y reintentá.`);
    }
    async click(text, scope = document) {
      const el = await this.wait(() => this.button(text, scope), `encontrar «${text}»`);
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') throw new Error(`WhatsApp no habilitó «${text}».`);
      el.click(); await pause(220);
    }
    async write(el, value) {
      this.check(); el.focus();
      if (el instanceof HTMLInputElement) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        const selection = window.getSelection(), range = document.createRange();
        range.selectNodeContents(el); selection.removeAllRanges(); selection.addRange(range);
        if (!document.execCommand('insertText', false, value)) throw new Error('WhatsApp no permitió escribir en el nombre de la lista.');
      }
      await pause(150);
    }
    async back() { await this.click('Atrás'); }
    async returnToChats() {
      for (let i = 0; i < 5 && this.button('Atrás'); i++) await this.back();
      const chats = this.button('Chats'); if (chats) { chats.click(); await pause(250); }
      await this.wait(() => this.find('#all-filter'), 'abrir Chats');
    }
    async settings() {
      if (this.find('[role="dialog"]') || this.find('[data-testid="edit-label-input"]')) throw new Error('Cerrá el formulario abierto en WhatsApp antes de preparar una lista.');
      await this.returnToChats();
      await this.click('Ajustes');
      const tools = await this.wait(() => this.find('[data-testid="li-biz-tools"]'), 'abrir herramientas de empresa');
      tools.click(); await pause(250);
      await this.click('Listas');
      await this.wait(() => this.find('[role="list"][aria-label="Tus listas"]'), 'abrir las listas de WhatsApp');
    }
    isFeaturedName(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase() === 'destacados'; }
    async openFeatured() {
      if (this.find('[role="dialog"]') || this.find('[data-testid="edit-label-input"]')) throw new Error('Cerrá el formulario abierto en WhatsApp antes de vincular Destacados.');
      // Prefer the visible chat filters; opening a list does not enter Settings.
      if (!this.find('#all-filter')) await this.returnToChats();
      const tabs = [...document.querySelectorAll('[role="tab"]')].filter(el => !el.closest('#bb-crm-extension-root') && this.isFeaturedName(this.label(el)));
      if (tabs.length === 1 && this.visible(tabs[0])) {
        this.listName = this.label(tabs[0]); tabs[0].click();
      } else {
        const menu = await this.wait(() => this.find('#additional-filters'), 'abrir las listas'); menu.click();
        await this.wait(() => this.find('[role="menu"]'), 'abrir el menú de listas');
        const items = [...document.querySelectorAll('[role="menuitemcheckbox"]')].filter(el => this.visible(el) && this.isFeaturedName(this.label(el)));
        if (items.length !== 1) {
          menu.click();
          throw new Error('Debe existir una única lista llamada Destacados (puede llevar un emoji). No se creó ni modificó ninguna lista.');
        }
        this.listName = this.label(items[0]); items[0].click();
      }
      await this.wait(() => this.selected(), 'abrir Destacados');
    }
    selected() {
      return [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some(el => !el.closest('#bb-crm-extension-root') && this.label(el) === this.listName);
    }
    async readMembers() {
      const names = new Set(); let previous = -1, stalled = 0;
      const pane = await this.wait(() => document.querySelector('#pane-side') || this.find('#side'), 'leer Destacados');
      for (let step = 0; step < 500; step++) {
        this.check();
        if (!this.selected()) throw new Error('Cambiaste de lista. Se canceló la vinculación.');
        const grid = pane.querySelector('[role="grid"]');
        if (!grid) return [];
        grid.querySelectorAll('[role="row"]').forEach(row => {
          const title = row.querySelector('[data-testid="cell-frame-title"]') || row.querySelector('span[title]');
          if (title) names.add(this.label(title));
        });
        const total = Number(grid.getAttribute('aria-rowcount'));
        if (total && names.size >= total) break;
        if (pane.scrollTop === previous) stalled++; else stalled = 0;
        if (stalled >= 3) break;
        previous = pane.scrollTop;
        pane.scrollTop += Math.max(200, pane.clientHeight * 0.75);
        pane.dispatchEvent(new Event('scroll', { bubbles: true }));
        await pause(400);
      }
      pane.scrollTop = 0;
      return [...names];
    }
    async syncFeatured({ leads, featured, phone, fullName, setFeatured }) {
      if (this.busy) return false;
      this.busy = true; this.cancelled = false;
      let editing = false, imported = 0;
      try {
        this.report('Leyendo Destacados de WhatsApp…');
        await this.openFeatured();
        const members = await this.readMembers();
        const { operations, unresolved } = featuredPlan({ members, leads, featured, phone, fullName });
        if (!operations.length) { this.report(`No hay destacados para vincular${unresolved.length ? '; hay contactos sin coincidencia en el CRM' : ''}.`); return true; }
        await this.settings();
        const list = this.find('[role="list"][aria-label="Tus listas"]');
        const rows = [...list.querySelectorAll('[role="gridcell"]')].filter(el => this.visible(el) && this.label(el) === this.listName);
        if (rows.length !== 1) throw new Error('No se encontró tu lista Destacados. No se creó ninguna lista.');
        rows[0].click(); await pause(300);
        const input = await this.wait(() => this.find('[data-testid="edit-label-input"]'), 'abrir Destacados');
        if (this.label(input) !== this.listName) throw new Error('La lista abierta no es la lista Destacados elegida.');
        editing = true;
        await this.click('Editar personas o grupos');
        const dialog = await this.wait(() => this.find('[role="dialog"]'), 'abrir los integrantes');
        const search = await this.wait(() => this.find('input[role="textbox"], input[type="text"]', undefined, dialog), 'buscar por teléfono');
        let linked = 0, missing = 0;
        for (let i = 0; i < operations.length; i++) {
          this.check();
          const operation = operations[i];
          this.report(`Vinculando Destacados: ${i + 1}/${operations.length}. Solo se agregan contactos.`);
          if (!dialog.isConnected || !input.isConnected) throw new Error('Se cerró la vinculación de Destacados.');
          await this.write(search, operation.phone); await pause(900); this.check();
          if (search.value !== operation.phone) throw new Error('Cambió la búsqueda. Se detuvo la vinculación.');
          const matches = [...dialog.querySelectorAll('[role="checkbox"]')].filter(el => !el.parentElement.closest('[role="checkbox"]') && this.visible(el));
          if (matches.length !== 1) { missing++; continue; }
          const row = matches[0], checkbox = row.querySelector('input[type="checkbox"]');
          if (!checkbox) throw new Error('WhatsApp cambió su selector de contactos.');
          // A name only proposes a match. Import requires a checked full-phone result in this exact list.
          if (operation.importIds.length && checkbox.checked) {
            for (const id of operation.importIds) { await setFeatured(id); imported++; }
          } else if (operation.importIds.length) missing++;
          if (operation.add && !checkbox.checked) {
            checkbox.click();
            await this.wait(() => row.getAttribute('aria-checked') === 'true', 'agregar el contacto', 2500);
          }
          if (operation.add) linked++;
        }
        await this.click('Confirmar', dialog);
        await this.wait(() => !dialog.isConnected, 'confirmar los integrantes');
        const save = await this.wait(() => this.button('Guardar lista'), 'guardar Destacados');
        if (save.disabled || save.getAttribute('aria-disabled') === 'true') await this.back();
        else { await this.click('Guardar lista'); await this.wait(() => !input.isConnected, 'guardar Destacados'); }
        editing = false;
        await this.openFeatured();
        this.report(`Destacados: ${linked} vinculados desde el CRM; ${imported} agregados a la estrella de la web.${missing + unresolved.length ? ` ${missing + unresolved.length} sin coincidencia verificable; se conservaron sin cambios.` : ''}`);
        return true;
      } catch (error) {
        this.cancelled = false;
        if (editing) {
          try {
            const dialog = this.find('[role="dialog"]');
            const close = dialog && /Edita los elementos de la lista/.test(dialog.textContent) && this.button('Cerrar', dialog);
            if (close) { close.click(); await pause(350); }
            const input = this.find('[data-testid="edit-label-input"]');
            if (input && this.label(input) === this.listName) {
              await this.back(); await pause(350);
              const discard = this.find('[role="dialog"]');
              if (discard?.textContent.includes('¿Deseas descartar los cambios?')) await this.click('Descartar', discard);
            }
          } catch {}
        }
        this.report(`${error.message}${imported ? ` Ya se marcaron ${imported} contactos en el CRM.` : ''}`);
        return false;
      } finally { this.busy = false; }
    }
    async all() {
      if (this.busy) { this.cancel(); return false; }
      this.cancelled = false;
      try { await this.returnToChats(); const all = this.find('#all-filter'); all.click(); this.report('Todos los chats de WhatsApp'); return true; }
      catch (error) { this.report(error.message); return false; }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { NativeLists, featuredPlan };
  else globalThis.BBWhatsAppFeaturedBridge = NativeLists;
})();

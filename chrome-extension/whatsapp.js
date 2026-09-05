(() => {
  if (document.getElementById("bb-crm-extension-root")) return;

  const state = {
    leads: [],
    templates: [],
    lead: null,
    selectedTemplate: null,
    imageFile: null,
    imagePreviewUrl: "",
    contactTabs: [],
    activeTabId: "all",
    conversationSyncTimer: null,
    featuredLeadIds: [],
    contextLoadPromise: null,
    contextLoadedAt: 0,
  };

  const DEFAULT_CONTACT_TABS = [
    { id: "all", name: "Todos", status: "" },
    { id: "featured", name: "Destacados", status: "", kind: "featured" },
    { id: "new", name: "Nuevos", status: "NEW" },
    { id: "progress", name: "En curso", status: "En curso" },
    { id: "unanswered", name: "No contesta", status: "No Contesta" },
    { id: "closed", name: "Cerrados", status: "Vendido" },
  ];

  const root = document.createElement("aside");
  root.id = "bb-crm-extension-root";
  root.innerHTML = `
    <nav class="bb-topbar" aria-label="Listas de contactos del CRM">
      <div class="bb-contact-tabs" role="tablist" aria-label="Contactos por estado"></div>
      <div class="bb-topbar-actions">
        <button class="bb-topbar-action bb-open-templates" type="button" aria-label="Abrir plantillas">
          <span aria-hidden="true">▤</span> Plantillas
        </button>
        <button class="bb-topbar-action bb-topbar-create" type="button" aria-label="Crear un nuevo cliente">
          <span aria-hidden="true">＋</span> Nuevo cliente
        </button>
        <button class="bb-edit-tabs" type="button" aria-label="Editar pestañas">
          <span aria-hidden="true">☷</span> Editar
        </button>
      </div>
      <button class="bb-topbar-brand" type="button" aria-label="Ver datos del cliente en Barrera Brokers CRM" title="Ver datos del cliente">
        <img src="${chrome.runtime.getURL("bb-logo.jpg")}" alt="Barrera Brokers" />
        <span>Ver cliente</span>
      </button>
    </nav>
    <section class="bb-tabs-editor" aria-label="Editar pestañas" hidden>
      <header>
        <div><strong>Organizar contactos</strong><span>Creá pestañas según el estado del lead.</span></div>
        <button class="bb-editor-close" type="button" aria-label="Cerrar">×</button>
      </header>
      <div class="bb-tabs-editor-list"></div>
      <footer>
        <button class="bb-add-tab" type="button">＋ Añadir pestaña</button>
        <button class="bb-save-tabs" type="button">Guardar cambios</button>
      </footer>
    </section>
    <button class="bb-launcher" type="button" aria-label="Abrir Barrera CRM" aria-expanded="false">
      <img src="${chrome.runtime.getURL("bb-logo.jpg")}" alt="" />
    </button>
    <section class="bb-panel" aria-label="Barrera Brokers CRM" hidden>
      <header class="bb-header">
        <div>
          <strong>Barrera Brokers</strong>
          <span>CRM conectado a WhatsApp</span>
        </div>
        <button class="bb-icon-button bb-close" type="button" aria-label="Cerrar panel">×</button>
      </header>
      <main class="bb-content">
        <form class="bb-search">
          <label for="bb-phone">Buscar cliente</label>
          <div class="bb-search-row">
            <input id="bb-phone" autocomplete="off" placeholder="Nombre, teléfono o email" />
            <button type="submit">Buscar</button>
          </div>
          <p>Buscá por nombre, apellido, teléfono o correo electrónico.</p>
        </form>
        <button class="bb-create-toggle" type="button">＋ Crear nuevo cliente</button>
        <div class="bb-status" role="status">Abrí el panel para conectar con el CRM.</div>
        <section class="bb-results" hidden></section>
        <section class="bb-client" hidden></section>
        <section class="bb-lead-context" hidden></section>
        <section class="bb-create-client" hidden>
          <div class="bb-section-heading">
            <h2>Nuevo cliente</h2>
            <button class="bb-text-button bb-cancel-create" type="button">Cancelar</button>
          </div>
          <form class="bb-create-form">
            <div class="bb-form-grid">
              <label><span>Nombre</span><input name="firstName" autocomplete="given-name" required /></label>
              <label><span>Apellido</span><input name="lastName" autocomplete="family-name" required /></label>
            </div>
            <label><span>Email</span><input name="email" type="email" autocomplete="email" required placeholder="cliente@email.com" /></label>
            <div class="bb-phone-grid">
              <label><span>País</span><input name="countryCode" value="+54" required /></label>
              <label><span>Teléfono</span><input name="phone" inputmode="tel" autocomplete="tel" required /></label>
            </div>
            <label><span>Emprendimiento consultado</span><input name="developmentNameText" placeholder="Ej. Alpha Place Libertador" /></label>
            <label><span>Estado inicial</span><select name="status"><option value="NEW">Nuevo</option><option value="Contactado">Contactado</option><option value="En curso">En curso</option></select></label>
            <label><span>Propietario del contacto</span><input value="Sin propietario" disabled /></label>
            <button class="bb-primary bb-create-submit" type="submit">Guardar cliente en el CRM</button>
          </form>
        </section>
        <section class="bb-template-manager" hidden>
          <div class="bb-section-heading">
            <div><h2>Editor de plantillas</h2><p>Creá y organizá los mensajes disponibles para el equipo.</p></div>
            <button class="bb-text-button bb-close-template-manager" type="button">Cerrar</button>
          </div>
          <form class="bb-template-manager-form">
            <label><span>Título</span><input name="name" maxlength="80" placeholder="Ej. Primer contacto" required /></label>
            <label><span>Mensaje</span><textarea name="body" placeholder="Escribí la plantilla respetando los párrafos…" required></textarea></label>
            <div class="bb-template-manager-tools">
              <button class="bb-manager-variable" type="button" data-variable="{{cliente_nombre}}">＋ Nombre del cliente</button>
              <button class="bb-manager-variable" type="button" data-variable="{{propietario_contacto}}">＋ Propietario del contacto</button>
              <label class="bb-manager-image"><span>＋ Imagen opcional</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></label>
            </div>
            <div class="bb-manager-file" hidden></div>
            <div class="bb-manager-form-actions">
              <button class="bb-primary bb-manager-save" type="submit">Guardar plantilla</button>
              <button class="bb-manager-cancel-edit" type="button" hidden>Cancelar edición</button>
            </div>
          </form>
          <div class="bb-manager-list-heading"><strong>Plantillas guardadas</strong><span class="bb-manager-count"></span></div>
          <div class="bb-template-manager-list"></div>
        </section>
        <section class="bb-templates" hidden>
          <div class="bb-section-heading">
            <h2>Elegí cómo escribir</h2>
            <span class="bb-template-count"></span>
          </div>
          <button class="bb-new-message" type="button">
            <strong>＋ Nuevo mensaje</strong>
            <span>Escribí un texto desde cero</span>
          </button>
          <div class="bb-template-label">Plantillas</div>
          <div class="bb-template-list"></div>
        </section>
        <section class="bb-preview" hidden>
          <div class="bb-section-heading">
            <h2>Vista previa</h2>
            <button class="bb-text-button bb-back" type="button">Cambiar</button>
          </div>
          <div class="bb-compose-tools">
            <button class="bb-insert-variable" type="button" data-variable="{{cliente_nombre}}">＋ Nombre del cliente</button>
            <button class="bb-insert-variable" type="button" data-variable="{{propietario_contacto}}">＋ Propietario del contacto</button>
            <button class="bb-show-save-template" type="button">Guardar como plantilla</button>
          </div>
          <form class="bb-save-template" hidden>
            <label for="bb-template-title">Título de la plantilla</label>
            <div>
              <input id="bb-template-title" name="templateTitle" maxlength="80" placeholder="Ej. Primer contacto" required />
              <button type="submit">Guardar</button>
            </div>
          </form>
          <textarea class="bb-message" aria-label="Mensaje de WhatsApp" placeholder="Escribí el mensaje para el cliente…"></textarea>
          <div class="bb-attachments"></div>
          <div class="bb-image-picker">
            <label class="bb-image-button">
              <span>Adjuntar imagen</span>
              <small>JPG, PNG, WebP o GIF · máximo 5 MB</small>
              <input class="bb-image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
            </label>
            <div class="bb-image-preview" hidden></div>
          </div>
          <button class="bb-primary bb-insert" type="button">Continuar a WhatsApp</button>
          <p class="bb-helper">WhatsApp abrirá su vista previa para que confirmes el texto y la imagen antes de enviar.</p>
        </section>
      </main>
      <footer class="bb-footer">
        <a href="https://barrerabrokers.com/admin/crm" target="_blank" rel="noreferrer">Abrir CRM completo</a>
      </footer>
    </section>
  `;
  document.body.appendChild(root);
  document.documentElement.classList.add("bb-crm-topbar-active");

  const $ = (selector) => root.querySelector(selector);
  const launcher = $(".bb-launcher");
  const contactTabs = $(".bb-contact-tabs");
  const tabsEditor = $(".bb-tabs-editor");
  const tabsEditorList = $(".bb-tabs-editor-list");
  const panel = $(".bb-panel");
  const searchForm = $(".bb-search");
  const phoneInput = $("#bb-phone");
  const status = $(".bb-status");
  const results = $(".bb-results");
  const client = $(".bb-client");
  const leadContext = $(".bb-lead-context");
  const createToggle = $(".bb-create-toggle");
  const createClient = $(".bb-create-client");
  const createForm = $(".bb-create-form");
  const templatesSection = $(".bb-templates");
  const templateList = $(".bb-template-list");
  const templateManager = $(".bb-template-manager");
  const templateManagerForm = $(".bb-template-manager-form");
  const templateManagerList = $(".bb-template-manager-list");
  const preview = $(".bb-preview");
  const messageInput = $(".bb-message");
  const saveTemplateForm = $(".bb-save-template");
  const attachments = $(".bb-attachments");
  const imageInput = $(".bb-image-input");
  const imagePreview = $(".bb-image-preview");

  const digits = (value = "") => String(value).replace(/\D/g, "");
  const comparablePhone = (value = "") => digits(value).replace(/^549/, "54").slice(-10);
  const fullName = (lead) => `${lead.firstName || ""} ${lead.lastName || ""}`.trim();
  const normalizeText = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);

  function whatsAppPhone(lead) {
    let phone = digits(`${lead.countryCode || ""}${lead.phone || ""}`);
    // WhatsApp exige el 9 entre el código de Argentina y el número móvil.
    if (phone.startsWith("54") && !phone.startsWith("549")) phone = `549${phone.slice(2)}`;
    return phone;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No pudimos preparar la imagen para cambiar de conversación."));
      reader.readAsDataURL(file);
    });
  }

  function dataUrlToFile(dataUrl, name, type) {
    const [metadata, encoded] = dataUrl.split(",");
    const mime = type || metadata.match(/data:([^;]+)/)?.[1] || "image/jpeg";
    const bytes = atob(encoded);
    const buffer = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
    return new File([buffer], name || "imagen.jpg", { type: mime });
  }

  function setStatus(message, kind = "neutral") {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = false;
  }

  function leadsForTab(tab) {
    if (tab?.kind === "featured") {
      return state.leads.filter((lead) => state.featuredLeadIds.includes(String(lead.id)));
    }
    if (!tab?.status) return state.leads;
    const expected = normalizeText(tab.status);
    return state.leads.filter((lead) => normalizeText(lead.status || lead.leadStatus || lead.lead_status) === expected);
  }

  function renderContactTabs() {
    contactTabs.innerHTML = state.contactTabs.map((tab) => {
      const count = leadsForTab(tab).length;
      const selected = tab.id === state.activeTabId;
      return `<button class="bb-contact-tab" type="button" role="tab" aria-selected="${selected}" data-tab-id="${escapeHtml(tab.id)}">
        <span>${tab.kind === "featured" ? '<b class="bb-tab-star">★</b>' : ""}${escapeHtml(tab.name)}</span><small>${count}</small>
      </button>`;
    }).join("");
  }

  async function savePreferences() {
    const preferences = {
      contactTabs: state.contactTabs,
      featuredLeadIds: state.featuredLeadIds,
    };
    await chrome.storage.local.set({
      bbContactTabs: preferences.contactTabs,
      bbFeaturedLeadIds: preferences.featuredLeadIds,
    });
    const response = await chrome.runtime.sendMessage({ type: "BB_SAVE_PREFERENCES", preferences });
    if (!response?.ok) throw new Error(response?.error || "No se pudo guardar la configuración en el CRM.");
  }

  async function loadContactTabs() {
    const stored = await chrome.storage.local.get(["bbContactTabs", "bbFeaturedLeadIds"]);
    let remotePreferences = null;
    try {
      const response = await chrome.runtime.sendMessage({ type: "BB_LOAD_PREFERENCES" });
      if (response?.ok) remotePreferences = response.preferences;
    } catch {}

    const remoteHasData = Array.isArray(remotePreferences?.contactTabs)
      && remotePreferences.contactTabs.length > 0;
    const savedTabs = remoteHasData
      ? remotePreferences.contactTabs
      : Array.isArray(stored.bbContactTabs) && stored.bbContactTabs.length
        ? stored.bbContactTabs
        : DEFAULT_CONTACT_TABS.map((tab) => ({ ...tab }));
    state.contactTabs = savedTabs.some((tab) => tab.kind === "featured" || tab.id === "featured")
      ? savedTabs.map((tab) => tab.id === "featured" ? { ...tab, kind: "featured" } : tab)
      : [savedTabs[0], { ...DEFAULT_CONTACT_TABS[1] }, ...savedTabs.slice(1)];
    state.featuredLeadIds = remoteHasData && Array.isArray(remotePreferences.featuredLeadIds)
      ? remotePreferences.featuredLeadIds.map(String)
      : Array.isArray(stored.bbFeaturedLeadIds)
        ? stored.bbFeaturedLeadIds.map(String)
      : [];
    renderContactTabs();

    if (!remoteHasData && (stored.bbContactTabs?.length || stored.bbFeaturedLeadIds?.length)) {
      try {
        await savePreferences();
      } catch {}
    }
  }

  function availableStatuses() {
    return [...new Set(state.leads.map((lead) => lead.status || lead.leadStatus || lead.lead_status).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "es"));
  }

  function renderTabsEditor() {
    const statuses = [...new Set([
      ...availableStatuses(),
      ...state.contactTabs.map((tab) => tab.status).filter(Boolean),
    ])].sort((a, b) => String(a).localeCompare(String(b), "es"));
    tabsEditorList.innerHTML = state.contactTabs.map((tab) => `
      <div class="bb-tab-editor-row" data-editor-tab-id="${escapeHtml(tab.id)}">
        <input class="bb-tab-name" value="${escapeHtml(tab.name)}" aria-label="Nombre de la pestaña" maxlength="24" />
        <select class="bb-tab-status" aria-label="Estado del lead" ${tab.kind === "featured" ? "disabled" : ""}>
          ${tab.kind === "featured" ? '<option value="">★ Contactos destacados</option>' : ""}
          <option value="" ${!tab.status ? "selected" : ""}>Todos los estados</option>
          ${statuses.map((statusValue) => `<option value="${escapeHtml(statusValue)}" ${statusValue === tab.status ? "selected" : ""}>${escapeHtml(statusValue)}</option>`).join("")}
        </select>
        <button class="bb-delete-tab" type="button" aria-label="Eliminar pestaña" ${tab.kind === "featured" ? "disabled" : ""}>×</button>
      </div>
    `).join("");
  }

  function guessVisiblePhone() {
    const header = document.querySelector("#main header");
    const candidate = header?.textContent || "";
    const match = candidate.match(/\+?\d[\d\s().-]{7,}\d/);
    return match?.[0]?.trim() || "";
  }

  function visibleConversationIdentity(sourceRow = null) {
    const header = document.querySelector("#main header");
    const rowText = sourceRow?.textContent || "";
    const rowAttributes = [
      sourceRow?.getAttribute?.("data-cb-chat-phone"),
      sourceRow?.getAttribute?.("data-id"),
      sourceRow?.getAttribute?.("data-cb-chat-raw-id"),
      ...Array.from(sourceRow?.querySelectorAll?.("[data-id], [title], [aria-label]") || []).flatMap((element) => [
        element.getAttribute("data-id"),
        element.getAttribute("title"),
        element.getAttribute("aria-label"),
      ]),
    ].filter(Boolean).join(" ");
    const rowPhone = `${rowAttributes} ${rowText}`.match(/\+?\d[\d\s().-]{7,}\d/)?.[0]?.trim() || "";
    const rowName = sourceRow?.getAttribute?.("data-cb-chat-title")
      || Array.from(sourceRow?.querySelectorAll?.("span[title]") || [])
        .map((element) => element.getAttribute("title")?.trim())
        .find((value) => value && !/\d{8,}/.test(value))
      || "";
    if (!header) return { phone: rowPhone.match(/\d{8,}/)?.[0] || "", name: rowName };
    const text = header.textContent || "";
    const phoneMatch = text.match(/\+?\d[\d\s().-]{7,}\d/);
    const titledName = Array.from(header.querySelectorAll("span[title]"))
      .map((element) => element.getAttribute("title")?.trim())
      .find((value) => value && !/buscar|search|men[uú]|info/i.test(value));
    const directedName = Array.from(header.querySelectorAll('span[dir="auto"]'))
      .map((element) => element.textContent?.trim())
      .find((value) => value && value.length < 100);
    return {
      phone: rowPhone || phoneMatch?.[0]?.trim() || "",
      name: rowName || titledName || directedName || "",
    };
  }

  async function showCrmContactForOpenConversation(sourceRow = null) {
    const identity = visibleConversationIdentity(sourceRow);
    if (!identity.phone && !identity.name) return;
    if (!state.leads.length && !(await loadContext())) return;

    const phone = comparablePhone(identity.phone);
    const name = normalizeText(identity.name);
    const lead = state.leads.find((item) => {
      const candidatePhone = comparablePhone(`${item.countryCode || ""}${item.phone || ""}`);
      const candidateName = normalizeText(fullName(item));
      const phoneMatch = phone.length >= 8 && (candidatePhone.endsWith(phone) || phone.endsWith(candidatePhone));
      const nameMatch = name.length >= 3 && candidateName === name;
      return phoneMatch || nameMatch;
    });
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    searchForm.hidden = false;
    if (!lead) {
      openCreateClient(identity);
      setStatus("Contacto nuevo: completamos el nombre y el teléfono desde WhatsApp.", "success");
      return;
    }

    phoneInput.value = identity.phone || fullName(lead);
    status.hidden = true;
    renderLead(lead);
  }

  function applyVariables(value, lead) {
    const development = lead.developmentName || lead.developmentNameText || "el desarrollo";
    return String(value || "")
      .replaceAll("{{cliente_nombre}}", lead.firstName || "")
      .replaceAll("{{cliente_apellido}}", lead.lastName || "")
      .replaceAll("{{cliente_nombre_completo}}", fullName(lead))
      .replaceAll("{{cliente_email}}", lead.email || "")
      .replaceAll("{{cliente_telefono}}", `${lead.countryCode || ""} ${lead.phone || ""}`.trim())
      .replaceAll("{{desarrollo}}", development)
      .replaceAll("{{propietario_contacto}}", lead.assignedAgentName || "Barrera Brokers");
  }

  async function loadContext({ silent = false, force = false } = {}) {
    if (!force && state.leads.length && Date.now() - state.contextLoadedAt < 30_000) return true;
    if (state.contextLoadPromise) return state.contextLoadPromise;
    if (!silent) setStatus("Conectando con el CRM…");
    state.contextLoadPromise = (async () => {
      const response = await chrome.runtime.sendMessage({ type: "BB_LOAD_CONTEXT" });
      if (!response?.ok || response.leads?.__error || response.templates?.__error) {
        if (!silent) {
          setStatus(response?.error || response.leads?.__error || response.templates?.__error || "No se pudo conectar con el CRM.", "error");
        }
        return false;
      }
      state.leads = response.leads?.leads || [];
      state.templates = (response.templates?.templates || []).filter((item) => item.channel === "whatsapp");
      if (Array.isArray(response.preferences?.featuredLeadIds)) {
        state.featuredLeadIds = response.preferences.featuredLeadIds.map(String);
      }
      if (Array.isArray(response.preferences?.contactTabs) && response.preferences.contactTabs.length) {
        state.contactTabs = response.preferences.contactTabs;
      }
      state.contextLoadedAt = Date.now();
      await chrome.storage.local.set({
        bbCrmContextCache: {
          leads: state.leads,
          templates: state.templates,
          cachedAt: state.contextLoadedAt,
        },
      });
      if (!silent) setStatus("CRM conectado. Buscá un cliente por nombre, teléfono o email.", "success");
      renderContactTabs();
      return true;
    })().finally(() => {
      state.contextLoadPromise = null;
    });
    return state.contextLoadPromise;
  }

  async function hydrateCachedContext() {
    const { bbCrmContextCache } = await chrome.storage.local.get("bbCrmContextCache");
    if (Array.isArray(bbCrmContextCache?.leads)) state.leads = bbCrmContextCache.leads;
    if (Array.isArray(bbCrmContextCache?.templates)) state.templates = bbCrmContextCache.templates;
    state.contextLoadedAt = Number(bbCrmContextCache?.cachedAt) || 0;
    if (state.leads.length) renderContactTabs();
    void loadContext({ silent: true, force: true });
  }

  function renderLead(lead) {
    if (state.lead?.id !== lead.id) clearSelectedImage();
    state.lead = lead;
    searchForm.hidden = false;
    createToggle.hidden = false;
    results.hidden = true;
    createClient.hidden = true;
    templateManager.hidden = true;
    client.hidden = false;
    leadContext.hidden = false;
    const development = lead.developmentName
      || lead.developmentNameText
      || lead.development_name
      || lead.development_name_text
      || "Sin emprendimiento asignado";
    const leadStatus = lead.status || lead.leadStatus || lead.lead_status || "Sin estado";
    const owner = lead.assignedAgentName || lead.assigned_agent_name || "Sin propietario asignado";
    const contactPhone = `${lead.countryCode || ""} ${lead.phone || ""}`.trim() || "Sin teléfono";
    const isFeatured = state.featuredLeadIds.includes(String(lead.id));
    client.innerHTML = `
      <div class="bb-avatar">${(lead.firstName?.[0] || "")}${(lead.lastName?.[0] || "")}</div>
      <div class="bb-client-copy">
        <div class="bb-client-name-row">
          <strong>${escapeHtml(fullName(lead))}</strong>
          <button class="bb-feature-toggle" type="button" aria-label="${isFeatured ? "Quitar de destacados" : "Agregar a destacados"}" aria-pressed="${isFeatured}" title="${isFeatured ? "Quitar de destacados" : "Agregar a destacados"}">${isFeatured ? "★" : "☆"}</button>
        </div>
        <span class="bb-client-email">${escapeHtml(lead.email || "Sin email")}</span>
        <small>${escapeHtml(contactPhone)}</small>
      </div>
    `;
    leadContext.innerHTML = `
      <div class="bb-context-item">
        <span>Emprendimiento consultado</span>
        <strong>${escapeHtml(development)}</strong>
      </div>
      <div class="bb-context-item">
        <span>Estado del lead</span>
        <strong class="bb-status-badge">${escapeHtml(leadStatus)}</strong>
      </div>
      <div class="bb-context-item bb-context-owner">
        <span>Propietario del contacto</span>
        <strong>${escapeHtml(owner)}</strong>
      </div>
    `;
    renderTemplates();
  }

  function renderSearchResults(matches) {
    createToggle.hidden = false;
    client.hidden = true;
    leadContext.hidden = true;
    templatesSection.hidden = true;
    preview.hidden = true;
    createClient.hidden = true;
    templateManager.hidden = true;
    results.hidden = false;
    results.innerHTML = `
      <div class="bb-results-heading">${matches.length} clientes encontrados</div>
      ${matches.slice(0, 20).map((lead) => `
        <button type="button" class="bb-result" data-lead-id="${escapeHtml(lead.id)}">
          <strong>${escapeHtml(fullName(lead) || "Cliente sin nombre")}${state.featuredLeadIds.includes(String(lead.id)) ? '<i class="bb-result-star">★</i>' : ""}</strong>
          <span>${escapeHtml(lead.email || `${lead.countryCode || ""} ${lead.phone || ""}`.trim())}</span>
          <small>${escapeHtml(lead.developmentName || lead.developmentNameText || "Sin emprendimiento")} · ${escapeHtml(lead.status || "Sin estado")}</small>
        </button>
      `).join("")}
    `;
  }

  function openCreateClient(prefilledIdentity = null) {
    const identity = prefilledIdentity || visibleConversationIdentity();
    const nameParts = (identity.name || "").trim().split(/\s+/).filter(Boolean);
    createForm.reset();
    createForm.elements.countryCode.value = "+54";
    createForm.elements.status.value = "NEW";
    createForm.elements.firstName.value = nameParts.shift() || "";
    createForm.elements.lastName.value = nameParts.join(" ");
    createForm.elements.phone.value = identity.phone.replace(/^\+?54\s?9?/, "").trim();
    searchForm.hidden = false;
    createToggle.hidden = false;
    results.hidden = true;
    client.hidden = true;
    leadContext.hidden = true;
    templatesSection.hidden = true;
    preview.hidden = true;
    templateManager.hidden = true;
    createClient.hidden = false;
    status.hidden = true;
    createForm.elements.firstName.focus();
  }

  function renderTemplates() {
    preview.hidden = true;
    templatesSection.hidden = false;
    $(".bb-template-count").textContent = `${state.templates.length}`;
    if (!state.templates.length) {
      templateList.innerHTML = `<p class="bb-empty">Todavía no hay plantillas de WhatsApp en el CRM.</p>`;
      return;
    }
    templateList.innerHTML = state.templates.map((template) => `
      <button class="bb-template" type="button" data-template-id="${template.id}">
        <strong>${template.name}</strong>
        <span>${applyVariables(template.body, state.lead).slice(0, 92)}</span>
      </button>
    `).join("");
  }

  function renderTemplateManager() {
    createToggle.hidden = true;
    templateManager.hidden = false;
    $(".bb-manager-count").textContent = `${state.templates.length}`;
    templateManagerList.innerHTML = state.templates.length
      ? state.templates.map((template) => `
          <div class="bb-manager-template" data-manager-template-id="${escapeHtml(template.id)}">
            <div>
              <strong>${escapeHtml(template.name)}</strong>
              <span>${escapeHtml(String(template.body || "").replace(/\s+/g, " ").slice(0, 110))}</span>
              ${template.imageUrls?.length ? '<small>▣ Incluye imagen</small>' : ""}
            </div>
            <div class="bb-manager-row-actions">
              <button type="button" class="bb-manager-edit" aria-label="Editar plantilla ${escapeHtml(template.name)}">Editar</button>
              <button type="button" class="bb-manager-delete" aria-label="Eliminar plantilla ${escapeHtml(template.name)}">Eliminar</button>
            </div>
          </div>
        `).join("")
      : '<p class="bb-empty">Todavía no hay plantillas de WhatsApp.</p>';
  }

  function resetTemplateManagerForm() {
    templateManagerForm.reset();
    delete templateManagerForm.dataset.editingTemplateId;
    $(".bb-manager-file").hidden = true;
    $(".bb-manager-file").textContent = "";
    $(".bb-manager-save").textContent = "Guardar plantilla";
    $(".bb-manager-cancel-edit").hidden = true;
  }

  async function selectTemplate(templateId) {
    const template = state.templates.find((item) => item.id === templateId);
    if (!template || !state.lead) return;
    state.selectedTemplate = template;
    templatesSection.hidden = true;
    preview.hidden = false;
    saveTemplateForm.hidden = true;
    messageInput.value = applyVariables(template.body, state.lead);
    const imageUrls = template.imageUrls || [];
    attachments.innerHTML = imageUrls.map((url, index) => `
      <a href="${url}" target="_blank" rel="noreferrer">Imagen guardada ${index + 1}</a>
    `).join("");
    clearSelectedImage();
    if (imageUrls[0]) {
      const response = await chrome.runtime.sendMessage({ type: "BB_FETCH_TEMPLATE_IMAGE", url: imageUrls[0] });
      if (response?.ok) {
        const fileName = decodeURIComponent(new URL(imageUrls[0]).pathname.split("/").pop() || "imagen-plantilla.jpg");
        renderSelectedImage(new File([new Uint8Array(response.bytes)], fileName, { type: response.type }));
      } else {
        setStatus(response?.error || "No se pudo cargar la imagen guardada.", "error");
      }
    }
  }

  function createNewMessage() {
    state.selectedTemplate = null;
    templatesSection.hidden = true;
    preview.hidden = false;
    saveTemplateForm.hidden = true;
    messageInput.value = "";
    attachments.innerHTML = "";
    clearSelectedImage();
    messageInput.focus();
  }

  function clearSelectedImage() {
    if (state.imagePreviewUrl) URL.revokeObjectURL(state.imagePreviewUrl);
    state.imageFile = null;
    state.imagePreviewUrl = "";
    if (imageInput) imageInput.value = "";
    if (imagePreview) {
      imagePreview.hidden = true;
      imagePreview.innerHTML = "";
    }
  }

  function renderSelectedImage(file) {
    clearSelectedImage();
    state.imageFile = file;
    state.imagePreviewUrl = URL.createObjectURL(file);
    imagePreview.hidden = false;
    imagePreview.innerHTML = `
      <img src="${state.imagePreviewUrl}" alt="Imagen seleccionada para WhatsApp" />
      <div>
        <strong>${file.name}</strong>
        <span>${(file.size / 1024 / 1024).toFixed(2)} MB</span>
      </div>
      <button class="bb-remove-image" type="button" aria-label="Quitar imagen">×</button>
    `;
  }

  function insertIntoWhatsApp(text) {
    const composer = document.querySelector('#main footer div[contenteditable="true"][role="textbox"]')
      || document.querySelector('#main footer div[contenteditable="true"]');
    if (!composer) throw new Error("No encontramos el campo de mensaje. Abrí una conversación e intentá nuevamente.");
    replaceEditorText(composer, text);
  }

  function replaceEditorText(editor, text) {
    const value = String(text || "").replace(/\r\n?/g, "\n");
    editor.focus();
    document.execCommand("selectAll", false);
    document.execCommand("delete", false);
    // WhatsApp mantiene su propio modelo del editor. Si insertamos cada línea
    // por separado, registra las palabras pero puede ignorar los párrafos. Un
    // único pegado de texto plano conserva los saltos, igual que Cmd/Ctrl+V.
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", value);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboard,
    });
    editor.dispatchEvent(pasteEvent);

    // Respaldo para editores donde el evento de pegado no tiene manejador.
    if (!pasteEvent.defaultPrevented) {
      document.execCommand("insertText", false, value);
    }
  }

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function findWhatsAppImageInput() {
    const describe = (element) => [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-icon"),
      element.textContent,
    ].filter(Boolean).join(" ").toLowerCase();

    const isStickerControl = (element) => {
      const descriptor = describe(element.closest("label, button, [role=button], li") || element);
      return /sticker|calcoman[ií]a|pegatina/.test(descriptor);
    };

    const rankMediaInput = (input) => {
      const accept = (input.getAttribute("accept") || "").toLowerCase();
      if (!accept.includes("image") || accept.includes("application") || isStickerControl(input)) return -1;

      // Algunas versiones de WhatsApp usan solamente `image/*` para "Fotos y
      // videos". Debe seguir siendo un candidato válido; los indicios de video
      // y selección múltiple solo sirven para darle prioridad.
      let score = 20;
      if (accept.includes("video")) score += 300;
      if (input.multiple || input.hasAttribute("multiple")) score += 120;
      if (/jpe?g|png|gif/.test(accept)) score += 60;
      if (accept.trim() === "image/*") score += 10;
      if (accept.includes("webp") && !accept.includes("video")) score -= 10;
      return score;
    };

    const findInput = (inputs = Array.from(document.querySelectorAll('input[type="file"]'))) => inputs
      .map((input) => ({ input, score: rankMediaInput(input) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)[0]?.input || null;

    const attachButton = Array.from(document.querySelectorAll("button, [role=button]")).find((element) => {
      const label = describe(element);
      return label.includes("adjuntar") || label.includes("attach");
    });
    if (!attachButton) return findInput();

    attachButton.click();

    let mediaOption = null;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await wait(100);
      mediaOption = Array.from(document.querySelectorAll('button, [role="button"], li, label'))
        .filter((element) => !root.contains(element))
        .find((element) => /fotos? y videos?|photos? (?:&|and) videos?|im[aá]genes? y videos?|galer[ií]a/.test(describe(element)));
      if (mediaOption) break;
    }

    if (mediaOption) {
      const nestedInput = mediaOption.querySelector('input[type="file"]');
      if (nestedInput && rankMediaInput(nestedInput) >= 0) return nestedInput;
      mediaOption.click();
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await wait(100);
      const input = findInput();
      if (input) return input;
    }
    return null;
  }

  async function attachImageToWhatsApp(file, caption) {
    const input = await findWhatsAppImageInput();
    if (!input) {
      throw new Error("No encontramos el selector de imágenes de WhatsApp. Actualizá WhatsApp Web e intentá nuevamente.");
    }

    const editorsBeforeAttachment = new Set(Array.from(document.querySelectorAll(
      '[contenteditable]:not([contenteditable="false"]), [role="textbox"], [data-lexical-editor="true"]'
    )));

    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const findCaptionBox = () => {
      const candidates = Array.from(document.querySelectorAll(
        '[contenteditable]:not([contenteditable="false"]), [role="textbox"], [data-lexical-editor="true"]'
      ))
        .filter((element) => !root.contains(element))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 20
            && rect.height > 8
            && rect.bottom > 0
            && rect.top < window.innerHeight
            && style.display !== "none"
            && style.visibility !== "hidden"
            && !element.closest('[aria-hidden="true"]');
        });

      return candidates
        .map((element, index) => {
          const descriptor = [
            element.getAttribute("aria-label"),
            element.getAttribute("aria-placeholder"),
            element.getAttribute("data-placeholder"),
            element.parentElement?.getAttribute("data-placeholder"),
            element.closest('[role="dialog"], [aria-modal="true"]')?.textContent,
            element.parentElement?.textContent,
          ].filter(Boolean).join(" ").toLowerCase();
          const rect = element.getBoundingClientRect();
          let score = index;
          if (!editorsBeforeAttachment.has(element)) score += 300;
          if (/caption|comentario|descripci[oó]n|pie de foto|mensaje/.test(descriptor)) score += 200;
          if (element.hasAttribute("data-lexical-editor")) score += 80;
          if (element.closest('[role="dialog"], [aria-modal="true"]')) score += 100;
          if (element.closest("#main footer") && !element.closest('[role="dialog"], [aria-modal="true"]')) score -= 250;
          else score += 40;
          if (rect.top > window.innerHeight * 0.45) score += 20;
          return { element, score };
        })
        // Solo aceptamos el editor nuevo de la vista previa o uno identificado
        // explícitamente como descripción. Así el texto nunca cae en el
        // compositor normal y viaja junto con la imagen.
        .filter(({ score }) => score >= 200)
        .sort((a, b) => b.score - a.score)[0]?.element || null;
    };

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await wait(100);
      const captionBox = findCaptionBox();
      if (captionBox) {
        replaceEditorText(captionBox, caption);
        return;
      }
    }

    throw new Error("La imagen se adjuntó, pero no encontramos su campo de descripción. Escribí el texto debajo de la imagen antes de enviarla.");
  }

  async function registerActivity(body) {
    if (!state.lead) return;
    await chrome.runtime.sendMessage({
      type: "BB_REGISTER_ACTIVITY",
      activity: {
        leadId: state.lead.id,
        type: "whatsapp",
        title: `WhatsApp con ${state.lead.firstName}`,
        body,
        scheduledAt: new Date().toISOString(),
      },
    });
  }

  async function continueInClientChat(message) {
    if (!state.lead) throw new Error("Seleccioná primero un cliente del CRM.");
    const phone = whatsAppPhone(state.lead);
    if (phone.length < 10) throw new Error("El cliente no tiene un teléfono válido para WhatsApp.");

    const pending = {
      createdAt: Date.now(),
      phone,
      message,
      leadId: state.lead.id,
      leadName: state.lead.firstName || "cliente",
      image: state.imageFile ? {
        dataUrl: await fileToDataUrl(state.imageFile),
        name: state.imageFile.name,
        type: state.imageFile.type,
      } : null,
    };
    await chrome.storage.local.set({ bbPendingWhatsAppSend: pending });
    window.location.assign(`https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}`);
  }

  async function resumePendingSend() {
    const { bbPendingWhatsAppSend: pending } = await chrome.storage.local.get("bbPendingWhatsAppSend");
    if (!pending || Date.now() - pending.createdAt > 2 * 60 * 1000) {
      if (pending) await chrome.storage.local.remove("bbPendingWhatsAppSend");
      return;
    }

    const expectedPhone = digits(pending.phone);
    const currentPhone = digits(new URL(window.location.href).searchParams.get("phone") || "");
    if (currentPhone && currentPhone !== expectedPhone) return;

    await chrome.storage.local.remove("bbPendingWhatsAppSend");
    try {
      // Espera a que WhatsApp termine de abrir la conversación indicada.
      for (let attempt = 0; attempt < 80; attempt += 1) {
        if (document.querySelector("#main")) break;
        await wait(250);
      }

      if (pending.image) {
        const file = dataUrlToFile(pending.image.dataUrl, pending.image.name, pending.image.type);
        await attachImageToWhatsApp(file, pending.message || "");
      } else {
        insertIntoWhatsApp(pending.message || "");
      }

      await chrome.runtime.sendMessage({
        type: "BB_REGISTER_ACTIVITY",
        activity: {
          leadId: pending.leadId,
          type: "whatsapp",
          title: `WhatsApp con ${pending.leadName}`,
          body: [pending.message, pending.image ? `Imagen adjunta: ${pending.image.name}` : ""].filter(Boolean).join("\n\n"),
          scheduledAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      panel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      setStatus(error.message, "error");
    }
  }

  launcher.addEventListener("click", async () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    launcher.setAttribute("aria-expanded", String(willOpen));
    if (!willOpen) return;
    phoneInput.value ||= guessVisiblePhone();
    if (state.leads.length) {
      await showCrmContactForOpenConversation();
      void loadContext({ silent: true, force: true });
    } else if (await loadContext()) {
      await showCrmContactForOpenConversation();
    }
  });

  $(".bb-topbar-brand").addEventListener("click", async () => {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    phoneInput.value ||= guessVisiblePhone();
    if (state.leads.length) {
      await showCrmContactForOpenConversation();
      void loadContext({ silent: true, force: true });
    } else if (await loadContext()) {
      await showCrmContactForOpenConversation();
    }
  });

  $(".bb-open-templates").addEventListener("click", async () => {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    setStatus("Cargando plantillas…");
    const response = await chrome.runtime.sendMessage({ type: "BB_LOAD_TEMPLATES" });
    if (!response?.ok || response.templates?.__error) {
      setStatus(response?.error || response.templates?.__error || "No se pudieron cargar las plantillas.", "error");
      return;
    }
    state.templates = (response.templates?.templates || []).filter((item) => item.channel === "whatsapp");
    searchForm.hidden = true;
    results.hidden = true;
    client.hidden = true;
    leadContext.hidden = true;
    createClient.hidden = true;
    templatesSection.hidden = true;
    preview.hidden = true;
    status.hidden = true;
    renderTemplateManager();
    templateManagerForm.elements.name.focus();
  });


  $(".bb-topbar-create").addEventListener("click", async () => {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    if (!state.leads.length) await loadContext();
    openCreateClient();
  });

  document.addEventListener("dblclick", (event) => {
    if (root.contains(event.target) || !event.target.closest("#pane-side")) return;
    const conversationRow = event.target.closest('[role="listitem"], [role="row"], [data-cb-chat-id]');
    state.lead = null;
    client.hidden = true;
    leadContext.hidden = true;
    templatesSection.hidden = true;
    preview.hidden = true;
    clearTimeout(state.conversationSyncTimer);
    state.conversationSyncTimer = setTimeout(() => showCrmContactForOpenConversation(conversationRow), 0);
  }, true);

  contactTabs.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-tab-id]");
    if (!button) return;
    if (!state.leads.length && !(await loadContext())) return;
    const tab = state.contactTabs.find((item) => item.id === button.dataset.tabId);
    if (!tab) return;
    state.activeTabId = tab.id;
    renderContactTabs();
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    status.hidden = true;
    renderSearchResults(leadsForTab(tab));
  });

  $(".bb-edit-tabs").addEventListener("click", async () => {
    if (!state.leads.length) await loadContext();
    renderTabsEditor();
    tabsEditor.hidden = false;
  });

  $(".bb-editor-close").addEventListener("click", () => { tabsEditor.hidden = true; });

  $(".bb-add-tab").addEventListener("click", () => {
    state.contactTabs.push({ id: `custom-${Date.now()}`, name: "Nueva lista", status: "" });
    renderTabsEditor();
    tabsEditorList.querySelector(".bb-tab-editor-row:last-child .bb-tab-name")?.focus();
  });

  tabsEditorList.addEventListener("click", (event) => {
    const button = event.target.closest(".bb-delete-tab");
    if (!button || button.disabled || state.contactTabs.length === 1) return;
    const row = button.closest("[data-editor-tab-id]");
    state.contactTabs = state.contactTabs.filter((tab) => tab.id !== row.dataset.editorTabId);
    if (!state.contactTabs.some((tab) => tab.id === state.activeTabId)) state.activeTabId = state.contactTabs[0].id;
    renderTabsEditor();
  });

  $(".bb-save-tabs").addEventListener("click", async () => {
    const rows = Array.from(tabsEditorList.querySelectorAll("[data-editor-tab-id]"));
    state.contactTabs = rows.map((row, index) => ({
      id: row.dataset.editorTabId || `custom-${Date.now()}-${index}`,
      name: row.querySelector(".bb-tab-name").value.trim() || `Lista ${index + 1}`,
      status: row.querySelector(".bb-tab-status").value,
      ...(state.contactTabs.find((tab) => tab.id === row.dataset.editorTabId)?.kind === "featured" ? { kind: "featured" } : {}),
    }));
    try {
      await savePreferences();
    } catch (error) {
      setStatus(`${error.message} Se conservó una copia en este navegador.`, "error");
    }
    renderContactTabs();
    tabsEditor.hidden = true;
  });

  $(".bb-close").addEventListener("click", () => {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
  });

  $(".bb-create-toggle").addEventListener("click", openCreateClient);
  $(".bb-cancel-create").addEventListener("click", () => {
    createClient.hidden = true;
    setStatus("Buscá un cliente o seleccioná una conversación de WhatsApp.");
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $(".bb-create-submit");
    const formData = new FormData(createForm);
    const payload = { ...Object.fromEntries(formData.entries()), leaveUnassigned: true };
    try {
      button.disabled = true;
      button.textContent = "Guardando…";
      const response = await chrome.runtime.sendMessage({ type: "BB_CREATE_LEAD", lead: payload });
      if (!response?.ok) throw new Error(response?.error || "No se pudo crear el cliente.");
      const lead = response.result?.lead;
      if (!lead) throw new Error("El CRM no devolvió el cliente creado.");
      state.leads = [lead, ...state.leads.filter((item) => item.id !== lead.id)];
      renderContactTabs();
      renderLead(lead);
      setStatus("Cliente creado correctamente en el CRM.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Guardar cliente en el CRM";
    }
  });

  $(".bb-search").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.leads.length && !(await loadContext())) return;
    const query = normalizeText(phoneInput.value);
    const phone = comparablePhone(query);
    if (query.length < 2) {
      setStatus("Ingresá al menos 2 caracteres para buscar al cliente.", "error");
      return;
    }
    const matches = state.leads.filter((item) => {
      const candidate = comparablePhone(`${item.countryCode || ""}${item.phone || ""}`);
      const name = normalizeText(fullName(item));
      const email = normalizeText(item.email);
      const phoneMatch = phone.length >= 4 && (candidate.endsWith(phone) || phone.endsWith(candidate));
      return phoneMatch || name.includes(query) || email.includes(query);
    });
    if (!matches.length) {
      results.hidden = true;
      client.hidden = true;
      leadContext.hidden = true;
      templatesSection.hidden = true;
      preview.hidden = true;
      setStatus("No encontramos clientes con ese nombre, teléfono o email.", "error");
      return;
    }
    status.hidden = true;
    if (matches.length === 1) renderLead(matches[0]);
    else renderSearchResults(matches);
  });

  results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lead-id]");
    if (!button) return;
    const lead = state.leads.find((item) => String(item.id) === button.dataset.leadId);
    if (lead) renderLead(lead);
  });

  client.addEventListener("click", async (event) => {
    const button = event.target.closest(".bb-feature-toggle");
    if (!button || !state.lead) return;
    const id = String(state.lead.id);
    const isFeatured = state.featuredLeadIds.includes(id);
    state.featuredLeadIds = isFeatured
      ? state.featuredLeadIds.filter((leadId) => leadId !== id)
      : [...state.featuredLeadIds, id];
    try {
      await savePreferences();
    } catch (error) {
      setStatus(`${error.message} Se conservó una copia en este navegador.`, "error");
    }
    renderContactTabs();
    renderLead(state.lead);
  });

  templateList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-template-id]");
    if (button) void selectTemplate(button.dataset.templateId);
  });

  $(".bb-close-template-manager").addEventListener("click", () => {
    templateManager.hidden = true;
    searchForm.hidden = false;
    createToggle.hidden = false;
    setStatus("Buscá un cliente o seleccioná una conversación de WhatsApp.");
  });

  $(".bb-template-manager-tools").addEventListener("click", (event) => {
    const button = event.target.closest(".bb-manager-variable");
    if (!button) return;
    const textarea = templateManagerForm.elements.body;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.setRangeText(button.dataset.variable || "{{cliente_nombre}}", start, end, "end");
    textarea.focus();
  });

  templateManagerForm.elements.image.addEventListener("change", () => {
    const file = templateManagerForm.elements.image.files?.[0];
    const fileLabel = $(".bb-manager-file");
    if (!file) {
      fileLabel.hidden = true;
      fileLabel.textContent = "";
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      templateManagerForm.elements.image.value = "";
      fileLabel.hidden = true;
      setStatus("Elegí una imagen válida de hasta 5 MB.", "error");
      return;
    }
    fileLabel.textContent = `Imagen: ${file.name}`;
    fileLabel.hidden = false;
  });

  templateManagerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $(".bb-manager-save");
    const name = templateManagerForm.elements.name.value.trim();
    const body = templateManagerForm.elements.body.value.trim();
    const file = templateManagerForm.elements.image.files?.[0] || null;
    const editingId = templateManagerForm.dataset.editingTemplateId || "";
    const existingTemplate = state.templates.find((item) => String(item.id) === editingId);
    try {
      button.disabled = true;
      button.textContent = "Guardando…";
      const response = await chrome.runtime.sendMessage({
        type: "BB_CREATE_TEMPLATE",
        template: {
          id: editingId,
          channel: "whatsapp",
          name,
          category: "WhatsApp",
          subject: "Mensaje de WhatsApp",
          body,
          imageUrls: file ? [] : (existingTemplate?.imageUrls || []),
        },
        image: file ? { dataUrl: await fileToDataUrl(file), name: file.name, type: file.type } : null,
      });
      if (!response?.ok) throw new Error(response?.error || "No se pudo guardar la plantilla.");
      const template = response.result?.template;
      if (!template) throw new Error("El CRM no devolvió la plantilla creada.");
      state.templates = [template, ...state.templates.filter((item) => item.id !== template.id)];
      resetTemplateManagerForm();
      renderTemplateManager();
      setStatus(`Plantilla “${template.name}” guardada.`, "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = editingId ? "Guardar cambios" : "Guardar plantilla";
    }
  });

  $(".bb-manager-cancel-edit").addEventListener("click", () => {
    resetTemplateManagerForm();
    templateManagerForm.elements.name.focus();
  });

  templateManagerList.addEventListener("click", async (event) => {
    const row = event.target.closest("[data-manager-template-id]");
    const template = state.templates.find((item) => String(item.id) === row?.dataset.managerTemplateId);
    const editButton = event.target.closest(".bb-manager-edit");
    if (editButton && template) {
      templateManagerForm.dataset.editingTemplateId = String(template.id);
      templateManagerForm.elements.name.value = template.name || "";
      templateManagerForm.elements.body.value = template.body || "";
      templateManagerForm.elements.image.value = "";
      const fileLabel = $(".bb-manager-file");
      fileLabel.textContent = template.imageUrls?.length
        ? "La imagen guardada se conservará. Elegí otra para reemplazarla."
        : "";
      fileLabel.hidden = !template.imageUrls?.length;
      $(".bb-manager-save").textContent = "Guardar cambios";
      $(".bb-manager-cancel-edit").hidden = false;
      templateManagerForm.scrollIntoView({ behavior: "smooth", block: "start" });
      templateManagerForm.elements.name.focus();
      return;
    }

    const button = event.target.closest(".bb-manager-delete");
    if (!button) return;
    if (!template || !window.confirm(`¿Eliminar la plantilla “${template.name}”?`)) return;
    try {
      button.disabled = true;
      button.textContent = "Eliminando…";
      const response = await chrome.runtime.sendMessage({ type: "BB_DELETE_TEMPLATE", templateId: template.id });
      if (!response?.ok) throw new Error(response?.error || "No se pudo eliminar la plantilla.");
      state.templates = state.templates.filter((item) => item.id !== template.id);
      if (templateManagerForm.dataset.editingTemplateId === String(template.id)) resetTemplateManagerForm();
      renderTemplateManager();
      setStatus(`Plantilla “${template.name}” eliminada.`, "success");
    } catch (error) {
      button.disabled = false;
      button.textContent = "Eliminar";
      setStatus(error.message, "error");
    }
  });

  $(".bb-new-message").addEventListener("click", createNewMessage);

  $(".bb-compose-tools").addEventListener("click", (event) => {
    const button = event.target.closest(".bb-insert-variable");
    if (!button) return;
    const variable = button.dataset.variable || "{{cliente_nombre}}";
    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? start;
    messageInput.setRangeText(variable, start, end, "end");
    messageInput.focus();
  });

  $(".bb-show-save-template").addEventListener("click", () => {
    saveTemplateForm.hidden = !saveTemplateForm.hidden;
    if (!saveTemplateForm.hidden) saveTemplateForm.elements.templateTitle.focus();
  });

  saveTemplateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = saveTemplateForm.querySelector("button[type=submit]");
    const title = saveTemplateForm.elements.templateTitle.value.trim();
    const body = messageInput.value.trim();
    if (!body) {
      setStatus("Escribí el contenido antes de guardar la plantilla.", "error");
      return;
    }
    try {
      button.disabled = true;
      button.textContent = "Guardando…";
      const response = await chrome.runtime.sendMessage({
        type: "BB_CREATE_TEMPLATE",
        template: { channel: "whatsapp", name: title, category: "WhatsApp", subject: "Mensaje de WhatsApp", body, imageUrls: [] },
        image: state.imageFile ? {
          dataUrl: await fileToDataUrl(state.imageFile),
          name: state.imageFile.name,
          type: state.imageFile.type,
        } : null,
      });
      if (!response?.ok) throw new Error(response?.error || "No se pudo guardar la plantilla.");
      const template = response.result?.template;
      if (!template) throw new Error("El CRM no devolvió la plantilla creada.");
      state.templates = [template, ...state.templates.filter((item) => item.id !== template.id)];
      saveTemplateForm.reset();
      saveTemplateForm.hidden = true;
      setStatus(`Plantilla “${template.name}” guardada en el CRM.`, "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Guardar";
    }
  });

  $(".bb-back").addEventListener("click", renderTemplates);

  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Seleccioná un archivo de imagen válido.", "error");
      clearSelectedImage();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus("La imagen supera el máximo de 5 MB.", "error");
      clearSelectedImage();
      return;
    }
    status.hidden = true;
    renderSelectedImage(file);
  });

  imagePreview?.addEventListener("click", (event) => {
    if (event.target.closest(".bb-remove-image")) clearSelectedImage();
  });

  $(".bb-insert").addEventListener("click", async () => {
    const button = $(".bb-insert");
    try {
      button.disabled = true;
      button.textContent = "Abriendo chat del cliente…";
      const rawMessage = messageInput.value.trim();
      if (!rawMessage && !state.imageFile) {
        throw new Error("Escribí un mensaje o adjuntá una imagen antes de continuar.");
      }
      const message = applyVariables(rawMessage, state.lead);
      await continueInClientChat(message);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Continuar a WhatsApp";
      setStatus(error.message, "error");
    }
  });

  loadContactTabs();
  hydrateCachedContext();
  resumePendingSend();
})();

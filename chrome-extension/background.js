const CRM_ORIGIN = "https://barrerabrokers.com";

async function getCrmTab(openWhenMissing = true) {
  const tabs = await chrome.tabs.query({ url: `${CRM_ORIGIN}/*` });
  if (tabs[0]?.id) return tabs[0];
  if (!openWhenMissing) return null;
  return chrome.tabs.create({ url: `${CRM_ORIGIN}/admin/crm?extension=1`, active: true });
}

async function callCrm(path, options = {}) {
  const tab = await getCrmTab(true);
  if (!tab?.id) throw new Error("No se pudo abrir el CRM.");

  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: "BB_CRM_FETCH",
      path,
      options,
    });
  } catch {
    await chrome.tabs.update(tab.id, { active: true });
    throw new Error("Iniciá sesión en el CRM y volvé a WhatsApp Web.");
  }
}

async function loadAllAccessibleLeads() {
  const pageSize = 500;
  const collected = [];
  let page = 1;
  let pageCount = 1;

  do {
    const result = await callCrm(
      `/api/crm/leads?owner=all&page=${page}&pageSize=${pageSize}&sort=createdAt&direction=desc`
    );
    if (result?.__error) throw new Error(result.__error);
    if (!Array.isArray(result?.leads)) {
      throw new Error("El CRM no devolvió una lista de contactos válida.");
    }

    collected.push(...result.leads);
    pageCount = Math.max(1, Number(result.pageCount) || 1);
    page += 1;
  } while (page <= pageCount);

  return {
    leads: collected,
    total: collected.length,
    page: 1,
    pageSize: collected.length,
    pageCount: 1,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "BB_LOAD_CONTEXT") {
    Promise.all([
      loadAllAccessibleLeads(),
      callCrm("/api/crm/templates"),
      callCrm("/api/crm/extension-preferences"),
    ])
      .then(([leads, templates, preferences]) => sendResponse({ ok: true, leads, templates, preferences: preferences?.preferences }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "BB_LOAD_TEMPLATES") {
    callCrm("/api/crm/templates")
      .then((templates) => sendResponse({ ok: true, templates }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "BB_LOAD_PREFERENCES") {
    callCrm("/api/crm/extension-preferences")
      .then((result) => {
        if (result?.__error) throw new Error(result.__error);
        sendResponse({ ok: true, preferences: result?.preferences });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "BB_SAVE_PREFERENCES") {
    callCrm("/api/crm/extension-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.preferences),
    })
      .then((result) => {
        if (result?.__error) throw new Error(result.__error);
        sendResponse({ ok: true, preferences: result?.preferences });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "BB_REGISTER_ACTIVITY") {
    callCrm("/api/crm/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.activity),
    })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "BB_CREATE_LEAD") {
    callCrm("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...message.lead, source: "WhatsApp" }),
    })
      .then((result) => {
        if (result?.__error) throw new Error(result.__error);
        sendResponse({ ok: true, result });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "BB_CREATE_TEMPLATE") {
    (async () => {
      let imageUrls = [];
      if (message.image) {
        const upload = await callCrm("/api/upload", { method: "POST", uploadImage: message.image });
        if (upload?.__error || !upload?.urls?.[0]) throw new Error(upload?.__error || "No se pudo guardar la imagen.");
        imageUrls = [upload.urls[0]];
      }
      return callCrm("/api/crm/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...message.template, imageUrls }),
      });
    })()
      .then((result) => {
        if (result?.__error) throw new Error(result.__error);
        sendResponse({ ok: true, result });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "BB_DELETE_TEMPLATE") {
    callCrm(`/api/crm/templates?id=${encodeURIComponent(message.templateId)}`, {
      method: "DELETE",
    })
      .then((result) => {
        if (result?.__error) throw new Error(result.__error);
        sendResponse({ ok: true, result });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "BB_FETCH_TEMPLATE_IMAGE") {
    fetch(message.url)
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo recuperar la imagen de la plantilla.");
        const blob = await response.blob();
        const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
        sendResponse({ ok: true, bytes, type: blob.type || "image/jpeg" });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

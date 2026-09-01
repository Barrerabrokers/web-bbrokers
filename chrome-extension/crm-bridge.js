chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "BB_CRM_FETCH") return false;

  const options = { ...message.options };
  if (options.uploadImage) {
    const { dataUrl, name, type } = options.uploadImage;
    const encoded = dataUrl.split(",")[1] || "";
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const formData = new FormData();
    formData.append("folder", "templates");
    formData.append("files", new File([bytes], name, { type }));
    options.body = formData;
    delete options.uploadImage;
    delete options.headers;
  }

  fetch(message.path, { ...options, credentials: "include" })
    .then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `El CRM respondió con estado ${response.status}.`);
      }
      sendResponse(data);
    })
    .catch((error) => sendResponse({ __error: error.message }));

  return true;
});

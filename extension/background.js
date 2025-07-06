const port = browser.runtime.connectNative("firefox_mcp_host");

const actions = {
  async openUrl({ url }) {
    const privateWindows = await browser.windows.getAll({
      populate: false,
      windowTypes: ["normal"],
      incognito: true,
    });

    if (privateWindows.length > 0) {
      await browser.tabs.create({ url, windowId: privateWindows[0].id });
    } else {
      await browser.windows.create({ url, incognito: true });
    }
    return { status: "ok", url };
  },
};

port.onMessage.addListener(async (request) => {
  const action = actions[request.action];
  if (action) {
    try {
      const result = await action(request.params);
      port.postMessage({ id: request.id, result });
    } catch (error) {
      port.postMessage({ id: request.id, error: { message: error.message } });
    }
  } else {
    port.postMessage({ id: request.id, error: { message: `Unknown action: ${request.action}` } });
  }
});

port.onDisconnect.addListener((p) => {
  if (p.error) console.error(`Disconnected with error: ${p.error.message}`);
});
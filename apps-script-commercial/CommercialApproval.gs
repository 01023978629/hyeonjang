function caDoPost_(request) {
  if (!request || !caIsAllowedAction_(request.action)) return caFail_('bad-request');
  return caFail_('not-implemented');
}

function caFail_(code) {
  return { ok: false, error: code };
}

function caOut_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

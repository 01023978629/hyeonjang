function doGet() { return caOut_(caFail_('method-not-allowed')); }

function doPost(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 65536) return caOut_(caFail_('bad-request'));
  var request;
  try { request = JSON.parse(raw); } catch (_) { return caOut_(caFail_('bad-request')); }
  return caOut_(caDoPost_(request));
}

function caDoPost_(request) {
  var actionIndex = request && caCommercialActionIndex_(request.action);
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
      !caHasExactFields_(request, ['action', 'token', 'requestAtKst', 'payload']) ||
      actionIndex < 0 || !caRequestFresh_(request.requestAtKst)) return caFail_('bad-request');
  if (!caTokenValid_(request.token)) return caFail_('unauthorized');
  if (actionIndex === 0) return caCommercialNow_(request.payload, request.requestAtKst);
  if (actionIndex === 1) return caCommercialApprovalIssue_(request.payload);
  if (actionIndex === 2) return caCommercialApprovalVerify_(request.payload);
  return caFail_('bad-request');
}

function caIsAllowedAction_(action) {
  return caCommercialActionIndex_(action) >= 0;
}

function caCommercialActionIndex_(action) {
  return ['commercialNow', 'commercialApprovalIssue', 'commercialApprovalVerify'].indexOf(action);
}

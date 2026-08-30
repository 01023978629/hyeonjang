function doGet() { return caOut_(caFail_('method-not-allowed')); }

function doPost(e) {
  var response;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 65536) {
      response = caFail_('bad-request');
    } else {
      var request;
      try { request = JSON.parse(raw); } catch (_) { request = null; }
      response = request === null ? caFail_('bad-request') : caDoPost_(request);
    }
  } catch (_) {
    response = caFail_('internal-error');
  }
  return caOut_(response);
}

function caDoPost_(request) {
  try {
    return caDoPostSafe_(request);
  } catch (_) {
    return caFail_('internal-error');
  }
}

function caDoPostSafe_(request) {
  var actionIndex = request && caCommercialActionIndex_(request.action);
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
      !caHasExactFields_(request, ['token', 'action', 'timestamp', 'payload']) || actionIndex < 0 ||
      caParseRequestTimestamp_(request.timestamp) === null) return caFail_('bad-request');
  var nowMs = caNowMs_();
  if (!caRequestFresh_(request.timestamp, nowMs)) return caFail_('bad-request');
  if (!caTokenValid_(request.token)) return caFail_('unauthorized');
  if (actionIndex === 0) return caCommercialNow_(request.payload, nowMs);
  if (actionIndex === 1) return caCommercialApprovalIssue_(request.payload, nowMs);
  if (actionIndex === 2) return caCommercialApprovalVerify_(request.payload, nowMs);
  return caFail_('bad-request');
}

function caIsAllowedAction_(action) {
  return caCommercialActionIndex_(action) >= 0;
}

function caCommercialActionIndex_(action) {
  return ['commercialNow', 'commercialApprovalIssue', 'commercialApprovalVerify'].indexOf(action);
}

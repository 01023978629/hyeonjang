function doGet() { return caOut_(caFail_('method-not-allowed')); }

function doPost(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 65536) return caOut_(caFail_('bad-request'));
  var request;
  try { request = JSON.parse(raw); } catch (_) { return caOut_(caFail_('bad-request')); }
  return caOut_(caDoPost_(request));
}

function caIsAllowedAction_(action) {
  return ['commercialNow', 'commercialApprovalIssue', 'commercialApprovalVerify'].indexOf(action) >= 0;
}

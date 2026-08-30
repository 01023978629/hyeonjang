var OO_ALLOWED_ACTIONS_ = [
  'officeOpsList',
  'officePilotCreate',
  'officePilotUpdate',
  'officePilotArchive',
  'officeConsentRecord',
  'officeConsentWithdraw',
  'officeInspectionCreate',
  'officeInspectionUpdate',
  'officeInspectionArchive',
  'officeInspectionBeginConversion',
  'officeInspectionArmLocalCommit',
  'officeInspectionRecordLocalCommit',
  'officeInspectionFinalizeConversion',
  'officeInspectionCancelConversion',
  'officeOpportunityCreate',
  'officeOpportunityUpdate',
  'officeOpportunityArchive',
  'officePilotRestore',
  'officeInspectionRestore',
  'officeOpportunityRestore',
  'officeOpsRetentionList'
];

function ooIsAllowedAction_(action) {
  return OO_ALLOWED_ACTIONS_.indexOf(action) >= 0;
}

function doGet() {
  return ooOut_(ooFail_('method-not-allowed'));
}

function doPost(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 131072) return ooOut_(ooFail_('bad-request'));
  var request;
  try {
    request = JSON.parse(raw);
  } catch (_) {
    return ooOut_(ooFail_('bad-request'));
  }
  return ooOut_(ooDoPost_(request));
}

function ooDoPost_(request) {
  if (!ooHasBasicEnvelope_(request)) return ooFail_('bad-request');

  var properties;
  var expectedToken;
  try {
    properties = PropertiesService.getScriptProperties();
    expectedToken = properties.getProperty('OFFICE_OPS_TOKEN');
  } catch (_) {
    return ooFail_('manual-recovery-required');
  }
  if (!expectedToken || request.token !== expectedToken) return ooFail_('unauthorized');

  var recoveryRequired;
  try {
    recoveryRequired = properties.getProperty('OFFICE_OPS_RECOVERY_REQUIRED');
  } catch (_) {
    return ooFail_('manual-recovery-required');
  }
  if (recoveryRequired !== '0') return ooFail_('manual-recovery-required');

  var enabled;
  try {
    enabled = properties.getProperty('OFFICE_OPS_ENABLED');
  } catch (_) {
    return ooFail_('office-disabled');
  }
  if (enabled !== '1') return ooFail_('office-disabled');
  if (!ooIsAllowedAction_(request.action)) return ooFail_('bad-request');

  return ooDispatch_(request);
}

function ooHasBasicEnvelope_(request) {
  return !!request && typeof request === 'object' && !Array.isArray(request) &&
    typeof request.token === 'string' && typeof request.action === 'string' &&
    typeof request.deviceId === 'string' && typeof request.timestamp === 'string' &&
    Object.prototype.hasOwnProperty.call(request, 'payload');
}

function ooOut_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

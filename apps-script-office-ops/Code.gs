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

var OO_SCRIPT_PROPERTY_KEYS_ = [
  'OFFICE_OPS_FILE_ID',
  'OFFICE_OPS_ENABLED',
  'OFFICE_OPS_RECOVERY_REQUIRED',
  'OFFICE_OPS_TOKEN'
];

function ooScriptPropertyKeyAllowed_(key) {
  return OO_SCRIPT_PROPERTY_KEYS_.indexOf(key) >= 0;
}

function ooScriptProperties_() {
  return PropertiesService.getScriptProperties();
}

function ooGetScriptProperty_(key) {
  if (!ooScriptPropertyKeyAllowed_(key)) throw new Error('office-ops-script-property-key-rejected');
  return ooScriptProperties_().getProperty(key);
}

function ooSetScriptProperty_(key, value) {
  if (!ooScriptPropertyKeyAllowed_(key)) throw new Error('office-ops-script-property-key-rejected');
  return ooScriptProperties_().setProperty(key, String(value));
}

function ooIsAllowedAction_(action) {
  return OO_ALLOWED_ACTIONS_.indexOf(action) >= 0;
}

function doGet() {
  return ooOut_(ooFail_('method-not-allowed'));
}

function doPost(e) {
  var result;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || typeof raw !== 'string' || raw.length > 131072) result = ooFail_('bad-request');
    else {
      try {
        var request = JSON.parse(raw);
        try { result = ooDoPost_(request); }
        catch (_) { result = ooFail_('server-error'); }
      } catch (parseError) {
        result = parseError && parseError.name === 'SyntaxError' ? ooFail_('bad-request') : ooFail_('server-error');
      }
    }
  } catch (_) {
    result = ooFail_('server-error');
  }
  try { return ooOut_(result); }
  catch (_) { return ooOut_(ooFail_('server-error')); }
}

function ooDoPost_(request) {
  if (!ooHasBasicEnvelope_(request)) return ooFail_('bad-request');

  var expectedToken;
  try {
    expectedToken = ooGetScriptProperty_('OFFICE_OPS_TOKEN');
  } catch (_) {
    return ooFail_('server-error');
  }
  if (!expectedToken || !ooConstantTimeEqual_(request.token, expectedToken)) return ooFail_('unauthorized');

  var recoveryRequired;
  try {
    recoveryRequired = ooGetScriptProperty_('OFFICE_OPS_RECOVERY_REQUIRED');
  } catch (_) {
    return ooFail_('server-error');
  }
  if (recoveryRequired !== '0') return ooFail_('manual-recovery-required');

  var enabled;
  try {
    enabled = ooGetScriptProperty_('OFFICE_OPS_ENABLED');
  } catch (_) {
    return ooFail_('server-error');
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

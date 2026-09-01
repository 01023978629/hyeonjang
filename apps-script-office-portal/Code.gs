/*
 * 독립 관리사무소 직원·입주민 포털 API.
 * 기존 현장 relay 프로젝트와 배포·Script Properties·저장소를 공유하지 않는다.
 */
'use strict';

var PORTAL_ACTIONS = Object.freeze([
  'portalHealth', 'portalRequestCode', 'portalVerifyCode', 'portalMe', 'portalLogout',
  'portalDashboard', 'portalStatusList', 'portalStatusSave', 'portalLogList', 'portalLogSave',
  'portalWorkOrderList', 'portalWorkOrderSave', 'portalNoticeList', 'portalNoticeSave',
  'portalCostList', 'portalCostSave', 'portalCostApprove', 'portalReportSummary',
  'portalUserList', 'portalUserSave', 'portalPermissionSave', 'portalAuditList'
]);

var PORTAL_PUBLIC_ACTIONS = Object.freeze([
  'portalHealth', 'portalRequestCode', 'portalVerifyCode'
]);

var PORTAL_HEADERS = Object.freeze({
  Offices: ['officeId', 'slug', 'complexName', 'enabled', 'permissionVersion', 'createdAt', 'updatedAt'],
  Users: ['userId', 'officeId', 'email', 'emailHash', 'displayName', 'role', 'unit', 'enabled', 'sessionVersion', 'permissionVersion', 'createdAt', 'updatedAt', 'lastLoginAt'],
  OtpChallenges: ['challengeId', 'officeId', 'userId', 'identityHash', 'codeHash', 'createdAt', 'expiresAt', 'attempts', 'lastSentAt', 'usedAt', 'revokedAt'],
  Sessions: ['sessionId', 'tokenHash', 'officeId', 'userId', 'issuedAt', 'expiresAt', 'revokedAt', 'sessionVersion', 'permissionVersion', 'officePermissionVersion', 'lastSeenAt'],
  PortalOperations: ['requestId', 'officeId', 'userId', 'role', 'action', 'entityType', 'entityId', 'inputHash', 'status', 'auditResult', 'createdAt', 'updatedAt'],
  RolePermissions: ['officeId', 'userId', 'role', 'capability', 'allowed', 'updatedAt', 'updatedBy'],
  ManagementStatus: ['statusId', 'officeId', 'location', 'category', 'state', 'summary', 'visibility', 'createdAt', 'updatedAt', 'updatedBy', 'revision'],
  ManagementLogs: ['logId', 'officeId', 'workDate', 'category', 'title', 'content', 'visibility', 'createdAt', 'updatedAt', 'updatedBy', 'revision'],
  WorkOrders: ['workOrderId', 'officeId', 'receiptNo', 'title', 'location', 'category', 'priority', 'status', 'assigneeUserId', 'dueDate', 'instructions', 'visibility', 'createdAt', 'updatedAt', 'updatedBy', 'revision'],
  Notices: ['noticeId', 'officeId', 'title', 'content', 'visibility', 'state', 'publishDate', 'expiresDate', 'createdAt', 'updatedAt', 'updatedBy', 'revision'],
  CostItems: ['costId', 'officeId', 'workOrderId', 'category', 'description', 'amountKrw', 'taxMode', 'status', 'createdAt', 'updatedAt', 'updatedBy', 'approvedBy', 'approvedAt', 'revision'],
  PortalAudit: ['auditId', 'officeId', 'actorUserId', 'role', 'action', 'entityType', 'entityId', 'result', 'at']
});

var PORTAL_OTP_TTL_MS = 10 * 60 * 1000;
var PORTAL_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
var PORTAL_OTP_RESEND_MS = 60 * 1000;
var PORTAL_OTP_HOURLY_LIMIT = 5;
var PORTAL_OTP_MAX_ATTEMPTS = 5;
var PORTAL_OTP_DIGITS = 6;
var PORTAL_OTP_GLOBAL_WINDOW_SECONDS = 10 * 60;
var PORTAL_OTP_GLOBAL_WINDOW_LIMIT = 500;
var PORTAL_OTP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
var PORTAL_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
var PORTAL_OPERATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
var PORTAL_MAX_BODY_BYTES = 48 * 1024;

function doGet() {
  return portalJson_({ ok: false, error: 'bad-request' });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || raw.length < 2 || raw.length > PORTAL_MAX_BODY_BYTES) {
      throw portalApiError_('invalid_request');
    }
    var request;
    try { request = JSON.parse(raw); } catch (parseError) { throw portalApiError_('invalid_request'); }
    var result = portalDispatch_(request);
    var response = { ok: true };
    Object.keys(result || {}).forEach(function (key) { response[key] = result[key]; });
    return portalJson_(response);
  } catch (err) {
    var code = err && (err.portalCode || err.code);
    return portalJson_({ ok: false, error: portalPublicErrorCode_(code) });
  }
}

function portalDispatch_(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw portalApiError_('invalid_request');
  }
  var action = portalPureString_(String(request.action || ''), 'action', 3, 64, /^[A-Za-z]+$/);
  if (PORTAL_ACTIONS.indexOf(action) === -1) throw portalApiError_('invalid_action');
  if (action === 'portalHealth') return portalHealth_();
  portalRequireEnabled_();
  if (action === 'portalRequestCode') return portalRequestCode_(portalPayload_(request));
  if (action === 'portalVerifyCode') return portalVerifyCode_(portalPayload_(request));

  var context = portalAuthenticate_(request.sessionToken);
  var payload = portalPayload_(request);
  if (action === 'portalMe') return portalMe_(context);
  if (action === 'portalLogout') return portalLogout_(context);
  if (action === 'portalDashboard') return portalDashboard_(context, payload);
  if (action === 'portalStatusList') return portalStatusList_(context, payload);
  if (action === 'portalStatusSave') return portalStatusSave_(context, payload);
  if (action === 'portalLogList') return portalLogList_(context, payload);
  if (action === 'portalLogSave') return portalLogSave_(context, payload);
  if (action === 'portalWorkOrderList') return portalWorkOrderList_(context, payload);
  if (action === 'portalWorkOrderSave') return portalWorkOrderSave_(context, payload);
  if (action === 'portalNoticeList') return portalNoticeList_(context, payload);
  if (action === 'portalNoticeSave') return portalNoticeSave_(context, payload);
  if (action === 'portalCostList') return portalCostList_(context, payload);
  if (action === 'portalCostSave') return portalCostSave_(context, payload);
  if (action === 'portalCostApprove') return portalCostApprove_(context, payload);
  if (action === 'portalReportSummary') return portalReportSummary_(context, payload);
  if (action === 'portalUserList') return portalUserList_(context, payload);
  if (action === 'portalUserSave') return portalUserSave_(context, payload);
  if (action === 'portalPermissionSave') return portalPermissionSave_(context, payload);
  if (action === 'portalAuditList') return portalAuditList_(context, payload);
  throw portalApiError_('invalid_action');
}

function portalPayload_(request) {
  if (request.payload === undefined) return request;
  if (!request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload)) {
    throw portalApiError_('invalid_payload');
  }
  return request.payload;
}

function portalApiError_(code) {
  var err = new Error(code);
  err.portalCode = code;
  return err;
}

function portalPublicErrorCode_(code) {
  code = String(code || '');
  if (code === 'server_not_configured' || code === 'server_schema_error' || code === 'service_disabled') return 'not-configured';
  if (code === 'invalid_credentials' || code === 'invalid_code' || code === 'code_expired') return 'invalid-credentials';
  if (code === 'rate_limited') return 'rate-limited';
  if (code === 'authentication_required' || code === 'session_expired' || code === 'session_invalid' || code === 'session_stale') return 'session-expired';
  if (code === 'forbidden' || code === 'office_scope_denied' || code === 'protected_admin' || code === 'permission_ceiling') return 'forbidden';
  if (code === 'last_system_admin' || code === 'last_manager_chief' || code === 'self_lockout_prevented') return 'last-admin';
  if (code === 'not_found' || code === 'user_not_found' || code === 'office_not_found') return 'not-found';
  if (code === 'invalid_request' || code === 'invalid_payload' || code === 'invalid_action' || code === 'method_not_allowed') return 'bad-request';
  if (code.indexOf('invalid_') === 0 || code.indexOf('duplicate_') === 0 ||
      code === 'duplicate_permission' || code === 'revision_conflict' || code === 'own_unit_scope_required') return 'invalid-input';
  return 'server-error';
}

function portalJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function portalNow_() {
  return new Date().toISOString();
}

function portalTime_(iso) {
  return new Date(String(iso || '')).getTime();
}

function portalTruth_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
}

function portalNumber_(value, fallback) {
  var number = Number(value);
  return isFinite(number) ? number : fallback;
}

function portalProps_() {
  return PropertiesService.getScriptProperties();
}

function portalHealth_() {
  var props = portalProps_();
  return {
    service: PORTAL_SCHEMA_VERSION,
    enabled: props.getProperty('OFFICE_PORTAL_ENABLED') === '1'
  };
}

function portalRequireEnabled_() {
  if (portalProps_().getProperty('OFFICE_PORTAL_ENABLED') !== '1') {
    throw portalApiError_('service_disabled');
  }
}

function portalRequiredProperty_(name, minimumLength) {
  var value = portalProps_().getProperty(name);
  if (!value || String(value).length < (minimumLength || 1)) throw portalApiError_('server_not_configured');
  return String(value);
}

function portalSpreadsheet_() {
  return SpreadsheetApp.openById(portalRequiredProperty_('OFFICE_PORTAL_SHEET_ID', 5));
}

function portalSheet_(name) {
  var headers = PORTAL_HEADERS[name];
  if (!headers) throw portalApiError_('server_schema_error');
  var sheet = portalSpreadsheet_().getSheetByName(name);
  if (!sheet) throw portalApiError_('server_schema_error');
  var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (actual.join('\u001f') !== headers.join('\u001f')) throw portalApiError_('server_schema_error');
  return sheet;
}

function portalRows_(name) {
  var headers = PORTAL_HEADERS[name];
  var values = portalSheet_(name).getDataRange().getValues();
  if (values.length <= 1) return [];
  return values.slice(1).map(function (row, index) {
    var item = { _row: index + 2 };
    headers.forEach(function (header, column) { item[header] = row[column]; });
    return item;
  });
}

function portalSaveRow_(name, item) {
  var headers = PORTAL_HEADERS[name];
  var sheet = portalSheet_(name);
  var values = headers.map(function (header) {
    return item[header] === undefined || item[header] === null ? '' : item[header];
  });
  if (item._row) {
    sheet.getRange(item._row, 1, 1, headers.length).setValues([values]);
  } else {
    sheet.appendRow(values);
    item._row = sheet.getLastRow();
  }
  return item;
}

function portalWithLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return callback(); } finally { lock.releaseLock(); }
}

function portalRandomId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '');
}

function portalRandomToken_() {
  var output = '';
  for (var i = 0; i < 4; i += 1) output += Utilities.getUuid().replace(/-/g, '');
  return output;
}

function portalRandomCode_() {
  var material = Utilities.getUuid() + '|' + Utilities.getUuid() + '|' + portalNow_();
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, material);
  var code = '';
  for (var i = 0; i < PORTAL_OTP_DIGITS; i += 1) code += String((bytes[i] & 255) % 10);
  return code;
}

function portalBestEffortOtpGate_(now) {
  try {
    var cache = CacheService.getScriptCache();
    var bucket = Math.floor(now / (PORTAL_OTP_GLOBAL_WINDOW_SECONDS * 1000));
    var key = 'office-portal-otp-global-' + bucket;
    var count = portalNumber_(cache.get(key), 0);
    if (count >= PORTAL_OTP_GLOBAL_WINDOW_LIMIT) return false;
    cache.put(key, String(count + 1), PORTAL_OTP_GLOBAL_WINDOW_SECONDS);
    return true;
  } catch (cacheError) {
    return true;
  }
}

function portalHmac_(propertyName, value) {
  var secret = portalRequiredProperty_(propertyName, 32);
  var bytes = Utilities.computeHmacSha256Signature(String(value), secret);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function portalConstantTimeEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  var mismatch = left.length ^ right.length;
  var length = Math.max(left.length, right.length);
  for (var i = 0; i < length; i += 1) {
    mismatch |= (left.charCodeAt(i % (left.length || 1)) || 0) ^ (right.charCodeAt(i % (right.length || 1)) || 0);
  }
  return mismatch === 0;
}

function portalOfficeById_(officeId) {
  return portalRows_('Offices').filter(function (row) { return row.officeId === officeId; })[0] || null;
}

function portalOfficeBySlug_(slug) {
  return portalRows_('Offices').filter(function (row) { return String(row.slug).toLowerCase() === slug; })[0] || null;
}

function portalUserById_(userId) {
  return portalRows_('Users').filter(function (row) { return row.userId === userId; })[0] || null;
}

function portalUserByIdentity_(officeId, emailHash) {
  return portalRows_('Users').filter(function (row) {
    return row.officeId === officeId && row.emailHash === emailHash;
  })[0] || null;
}

function portalUserOverrides_(user) {
  return portalRows_('RolePermissions').filter(function (row) {
    return row.officeId === user.officeId && row.userId === user.userId && row.role === user.role &&
      PORTAL_VIEW_CAPABILITIES.indexOf(row.capability) !== -1;
  }).map(function (row) {
    return { capability: row.capability, allowed: portalTruth_(row.allowed) };
  });
}

function portalPermissionsForUser_(user, overrides) {
  return portalPureEffectivePermissions_(user.role,
    overrides === undefined ? portalUserOverrides_(user) : overrides);
}

function portalAuthenticate_(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length < 64 || rawToken.length > 256 || !/^[A-Za-z0-9_-]+$/.test(rawToken)) {
    throw portalApiError_('authentication_required');
  }
  var tokenHash = portalHmac_('OFFICE_PORTAL_SESSION_SECRET', rawToken);
  var session = portalRows_('Sessions').filter(function (row) {
    return row.tokenHash === tokenHash && !row.revokedAt;
  })[0];
  if (!session || portalTime_(session.expiresAt) <= Date.now()) throw portalApiError_('session_expired');
  var user = portalUserById_(session.userId);
  var office = portalOfficeById_(session.officeId);
  if (!user || !office || user.officeId !== office.officeId || !portalTruth_(user.enabled) || !portalTruth_(office.enabled)) {
    throw portalApiError_('session_invalid');
  }
  portalPureRole_(user.role);
  if (portalNumber_(session.sessionVersion, -1) !== portalNumber_(user.sessionVersion, 0) ||
      portalNumber_(session.permissionVersion, -1) !== portalNumber_(user.permissionVersion, 0) ||
      portalNumber_(session.officePermissionVersion, -1) !== portalNumber_(office.permissionVersion, 0)) {
    throw portalApiError_('session_stale');
  }
  return {
    session: session,
    office: office,
    user: user,
    officeId: office.officeId,
    userId: user.userId,
    role: user.role,
    unit: user.unit || '',
    permissions: portalPermissionsForUser_(user)
  };
}

function portalRequirePermission_(context, capability) {
  portalPureAssertPermission_(context.permissions, capability);
}

function portalAudit_(context, action, entityType, entityId, result, officeId) {
  portalSaveRow_('PortalAudit', {
    auditId: portalRandomId_('aud'),
    officeId: officeId || (context && context.officeId) || '',
    actorUserId: (context && context.userId) || 'system',
    role: (context && context.role) || 'system',
    action: action,
    entityType: entityType || '',
    entityId: entityId || '',
    result: result || 'success',
    at: portalNow_()
  });
}

function portalInputHash_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value));
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function portalOperationAuditId_(operation) {
  return 'audop_' + String(operation.requestId).replace(/-/g, '');
}

function portalOperationByRequestId_(requestId) {
  return portalRows_('PortalOperations').filter(function (row) {
    return row.requestId === requestId;
  })[0] || null;
}

function portalBeginOperation_(context, requestId, action, entityType, entityId, inputHash, officeId, existingOperation) {
  requestId = portalPureRequestId_(requestId);
  var existing = arguments.length >= 8 ? existingOperation : portalOperationByRequestId_(requestId);
  if (existing) {
    var sameOperation = existing.officeId === officeId && existing.userId === context.userId &&
      existing.action === action && existing.entityType === entityType && existing.inputHash === inputHash;
    if (!sameOperation) throw portalApiError_('invalid_request_id_reuse');
    return { operation: existing, replayed: true };
  }
  var now = portalNow_();
  var operation = {
    requestId: requestId,
    officeId: officeId,
    userId: context.userId,
    role: context.role,
    action: action,
    entityType: entityType,
    entityId: entityId,
    inputHash: inputHash,
    status: 'started',
    auditResult: '',
    createdAt: now,
    updatedAt: now
  };
  portalSaveRow_('PortalOperations', operation);
  return { operation: operation, replayed: false };
}

function portalAppendOperationAudit_(operation) {
  var auditId = portalOperationAuditId_(operation);
  var exists = portalRows_('PortalAudit').some(function (row) { return row.auditId === auditId; });
  if (exists) return;
  portalSaveRow_('PortalAudit', {
    auditId: auditId,
    officeId: operation.officeId,
    actorUserId: operation.userId,
    role: operation.role,
    action: operation.action,
    entityType: operation.entityType,
    entityId: operation.entityId,
    result: operation.auditResult || 'success',
    at: portalNow_()
  });
}

function portalFinishOperation_(operation, auditResult) {
  operation.auditResult = auditResult || 'success';
  operation.status = 'primary_committed';
  operation.updatedAt = portalNow_();
  portalSaveRow_('PortalOperations', operation);
  try {
    portalAppendOperationAudit_(operation);
    operation.status = 'complete';
    operation.updatedAt = portalNow_();
    portalSaveRow_('PortalOperations', operation);
    return false;
  } catch (auditError) {
    operation.status = 'audit_pending';
    operation.updatedAt = portalNow_();
    portalSaveRow_('PortalOperations', operation);
    return true;
  }
}

function portalHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, function (character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function portalRequestCode_(payload) {
  var slug = portalPureSlug_(payload.officeCode);
  var email = portalPureEmail_(payload.email);
  var identityHash = portalHmac_('OFFICE_PORTAL_OTP_PEPPER', email);
  if (!portalBestEffortOtpGate_(Date.now())) {
    return {
      accepted: true,
      challengeId: Utilities.getUuid().toLowerCase(),
      expiresInSeconds: Math.floor(PORTAL_OTP_TTL_MS / 1000)
    };
  }
  var prepared = portalWithLock_(function () {
    var now = Date.now();
    var office = portalOfficeBySlug_(slug);
    var user = office ? portalUserByIdentity_(office.officeId, identityHash) : null;
    var eligible = Boolean(office && user && portalTruth_(office.enabled) && portalTruth_(user.enabled));
    var recent = portalRows_('OtpChallenges').filter(function (row) {
      return row.identityHash === identityHash && portalTime_(row.createdAt) > now - 60 * 60 * 1000;
    });
    var lastSent = recent.reduce(function (latest, row) {
      return Math.max(latest, portalTime_(row.lastSentAt) || 0);
    }, 0);
    var rateAllowed = recent.length < PORTAL_OTP_HOURLY_LIMIT && now - lastSent >= PORTAL_OTP_RESEND_MS;
    var challengeId = Utilities.getUuid().toLowerCase();
    if (!eligible || !rateAllowed) return { challengeId: challengeId, send: false };

    var code = portalRandomCode_();
    var createdAt = portalNow_();
    var expiresAt = new Date(now + PORTAL_OTP_TTL_MS).toISOString();
    portalSaveRow_('OtpChallenges', {
      challengeId: challengeId,
      officeId: office.officeId,
      userId: user.userId,
      identityHash: identityHash,
      codeHash: portalHmac_('OFFICE_PORTAL_OTP_PEPPER', challengeId + '|' + code),
      createdAt: createdAt,
      expiresAt: expiresAt,
      attempts: 0,
      lastSentAt: createdAt,
      usedAt: '',
      revokedAt: ''
    });
    return {
      challengeId: challengeId,
      expiresAt: expiresAt,
      send: true,
      email: user.email,
      complexName: office.complexName,
      code: code
    };
  });

  if (prepared.send) {
    try {
      MailApp.sendEmail({
        to: prepared.email,
        subject: '[만물 관리포털] 로그인 인증번호',
        name: '만물 관리포털',
        htmlBody: '<p>' + portalHtml_(prepared.complexName) + ' 관리포털 로그인 인증번호입니다.</p>' +
          '<p style="font-size:24px;font-weight:700;letter-spacing:4px">' + prepared.code + '</p>' +
          '<p>10분 안에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p>'
      });
    } catch (deliveryError) {
      try {
        portalWithLock_(function () {
          var row = portalRows_('OtpChallenges').filter(function (item) {
            return item.challengeId === prepared.challengeId;
          })[0];
          if (row) {
            row.revokedAt = portalNow_();
            portalSaveRow_('OtpChallenges', row);
            portalAudit_(null, 'portalRequestCodeDelivery', 'otp_challenge', row.challengeId, 'delivery_failed', row.officeId);
          }
        });
      } catch (ignoredDeliveryAuditError) {
        // Public response remains generic to avoid account enumeration.
      }
    }
  }
  return {
    accepted: true,
    challengeId: prepared.challengeId,
    expiresInSeconds: Math.floor(PORTAL_OTP_TTL_MS / 1000)
  };
}

function portalVerifyCode_(payload) {
  var challengeId = portalPureId_(payload.challengeId, 'challengeId');
  var slug = portalPureSlug_(payload.officeCode);
  var email = portalPureEmail_(payload.email);
  var code = portalPureString_(String(payload.code || ''), 'code', PORTAL_OTP_DIGITS, PORTAL_OTP_DIGITS, /^\d{6}$/);
  var identityHash = portalHmac_('OFFICE_PORTAL_OTP_PEPPER', email);
  /* Reject floods before taking the global script lock or scanning Sheets. */
  if (!portalBestEffortOtpGate_(Date.now())) throw portalApiError_('rate_limited');
  return portalWithLock_(function () {
    var challenge = portalRows_('OtpChallenges').filter(function (row) {
      return row.challengeId === challengeId;
    })[0];
    if (!challenge || challenge.usedAt || challenge.revokedAt) {
      throw portalApiError_('invalid_credentials');
    }
    if (portalTime_(challenge.expiresAt) <= Date.now()) {
      throw portalApiError_('invalid_credentials');
    }
    var requestedOffice = portalOfficeBySlug_(slug);
    var attempts = portalNumber_(challenge.attempts, 0) + 1;
    challenge.attempts = attempts;
    var codeHash = portalHmac_('OFFICE_PORTAL_OTP_PEPPER', challengeId + '|' + code);
    var valid = attempts <= PORTAL_OTP_MAX_ATTEMPTS &&
      portalConstantTimeEqual_(challenge.identityHash, identityHash) &&
      portalConstantTimeEqual_(challenge.codeHash, codeHash) &&
      Boolean(requestedOffice && challenge.officeId === requestedOffice.officeId);
    if (!valid) {
      if (attempts >= PORTAL_OTP_MAX_ATTEMPTS) challenge.revokedAt = portalNow_();
      portalSaveRow_('OtpChallenges', challenge);
      throw portalApiError_('invalid_credentials');
    }

    var user = portalUserById_(challenge.userId);
    var office = portalOfficeById_(challenge.officeId);
    if (!user || !office || user.officeId !== office.officeId || !portalTruth_(user.enabled) ||
        !portalTruth_(office.enabled) || !portalConstantTimeEqual_(user.emailHash, challenge.identityHash)) {
      challenge.revokedAt = portalNow_();
      portalSaveRow_('OtpChallenges', challenge);
      throw portalApiError_('invalid_credentials');
    }
    challenge.usedAt = portalNow_();
    portalSaveRow_('OtpChallenges', challenge);

    var rawToken = portalRandomToken_();
    var issuedAt = portalNow_();
    var session = {
      sessionId: portalRandomId_('ses'),
      tokenHash: portalHmac_('OFFICE_PORTAL_SESSION_SECRET', rawToken),
      officeId: office.officeId,
      userId: user.userId,
      issuedAt: issuedAt,
      expiresAt: new Date(Date.now() + PORTAL_SESSION_TTL_MS).toISOString(),
      revokedAt: '',
      sessionVersion: portalNumber_(user.sessionVersion, 0),
      permissionVersion: portalNumber_(user.permissionVersion, 0),
      officePermissionVersion: portalNumber_(office.permissionVersion, 0),
      lastSeenAt: issuedAt
    };
    portalSaveRow_('Sessions', session);
    user.lastLoginAt = issuedAt;
    portalSaveRow_('Users', user);
    var context = { officeId: office.officeId, userId: user.userId, role: user.role };
    portalAudit_(context, 'portalVerifyCode', 'session', session.sessionId, 'success');
    return {
      sessionToken: rawToken,
      expiresAt: portalTime_(session.expiresAt),
      permissions: portalPermissionsForUser_(user),
      user: portalPresentUser_(user, true),
      office: portalPresentOffice_(office)
    };
  });
}

function portalPresentOffice_(office) {
  return {
    id: office.officeId,
    slug: office.slug,
    name: office.complexName,
    active: portalTruth_(office.enabled)
  };
}

function portalPresentUser_(user, includeEmail, overrides) {
  var copy = {};
  Object.keys(user).forEach(function (key) { copy[key] = user[key]; });
  copy.permissions = portalPermissionsForUser_(user, overrides);
  return portalPureSafeUser_(copy, includeEmail);
}

function portalMe_(context) {
  return {
    user: portalPresentUser_(context.user, true),
    office: portalPresentOffice_(context.office),
    permissions: context.permissions.slice(),
    expiresAt: portalTime_(context.session.expiresAt)
  };
}

function portalLogout_(context) {
  return portalWithLock_(function () {
    var current = portalRows_('Sessions').filter(function (row) {
      return row.sessionId === context.session.sessionId;
    })[0];
    if (current && !current.revokedAt) {
      current.revokedAt = portalNow_();
      portalSaveRow_('Sessions', current);
    }
    portalAudit_(context, 'portalLogout', 'session', context.session.sessionId, 'success');
    return { loggedOut: true };
  });
}

function portalVisibleRecords_(sheetName, context, kind) {
  return portalRows_(sheetName).filter(function (row) {
    return row.officeId === context.officeId && portalPureCanSeeRecord_(row, context);
  }).map(function (row) {
    return portalPureProjectRecord_(row, context, kind);
  });
}

function portalDashboard_(context) {
  portalRequirePermission_(context, 'dashboard.view');
  var canSeeStatuses = portalPureCan_(context.permissions, 'status.view');
  var canSeeLogs = portalPureCan_(context.permissions, 'logs.view');
  var canSeeNotices = portalPureCan_(context.permissions, 'notices.view');
  var canSeeWorkOrders = portalPureCan_(context.permissions, 'workorders.view');
  var statuses = canSeeStatuses ? portalVisibleRecords_('ManagementStatus', context, 'status') : [];
  var logs = canSeeLogs ? portalVisibleRecords_('ManagementLogs', context, 'log') : [];
  var workOrders = canSeeWorkOrders ? portalVisibleWorkOrders_(context) : [];
  var notices = canSeeNotices ? portalVisibleNotices_(context) : [];
  var today = portalToday_();
  statuses.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  logs.sort(function (a, b) { return String(b.workDate + '|' + b.updatedAt).localeCompare(String(a.workDate + '|' + a.updatedAt)); });
  workOrders.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  notices = notices.filter(function (notice) {
    return notice.state === 'published' && (!notice.publishDate || notice.publishDate <= today) &&
      (!notice.expiresDate || notice.expiresDate >= today);
  });
  notices.sort(function (a, b) { return String(b.publishDate + '|' + b.updatedAt).localeCompare(String(a.publishDate + '|' + a.updatedAt)); });
  var counts = {
      statuses: statuses.length,
      logs: logs.length,
      workOrders: workOrders.length,
      reports: 0,
      notices: notices.length,
      costs: 0
    };
  var metrics = [];
  if (canSeeStatuses) metrics.push({ label: '관리 상태', value: counts.statuses });
  if (canSeeLogs) metrics.push({ label: '관리 일지', value: counts.logs });
  if (canSeeWorkOrders) metrics.push({ label: '작업 지시', value: counts.workOrders });
  if (canSeeNotices) metrics.push({ label: '공지', value: counts.notices });
  return {
    metrics: metrics,
    notices: notices.slice(0, 5).map(function (notice) {
      return { noticeId: notice.noticeId, title: notice.title, publishDate: notice.publishDate, state: notice.state };
    }),
    counts: counts,
    recentStatuses: statuses.slice(0, 5),
    recentLogs: logs.slice(0, 5),
    recentWorkOrders: workOrders.slice(0, 5)
  };
}

function portalStatusList_(context, payload) {
  portalRequirePermission_(context, 'status.view');
  var limit = portalPureLimit_(payload.limit, 100, 200);
  var items = portalVisibleRecords_('ManagementStatus', context, 'status');
  if (payload.state) items = items.filter(function (row) { return row.state === payload.state; });
  if (payload.category) items = items.filter(function (row) { return row.category === payload.category; });
  items.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return { statuses: items.slice(0, limit) };
}

function portalStatusSave_(context, payload) {
  portalRequirePermission_(context, 'status.manage');
  var source = payload.status || payload;
  var requestId = portalPureRequestId_(payload.requestId || source.requestId);
  var input = portalPureRecordInput_({
    id: source.statusId,
    location: source.location,
    category: source.category,
    state: source.state,
    summary: source.summary,
    visibility: source.visibility,
    revision: source.revision
  }, 'status');
  var inputHash = portalInputHash_({ kind: 'status', input: input });
  return portalWithLock_(function () {
    var started = portalBeginOperation_(context, requestId, 'portalStatusSave', 'status',
      input.id || portalRandomId_('sts'), inputHash, context.officeId);
    var operation = started.operation;
    var row = portalRows_('ManagementStatus').filter(function (item) {
      return item.statusId === operation.entityId && item.officeId === context.officeId;
    })[0];
    if (started.replayed && row && (operation.status !== 'started' || !input.id ||
        (portalNumber_(row.revision, 0) === input.revision + 1 && row.location === input.location &&
         row.category === input.category && row.state === input.state && row.summary === input.summary &&
         row.visibility === input.visibility))) {
      var replayAuditPending = portalFinishOperation_(operation, input.id ? 'updated' : 'created');
      return { status: portalPureProjectRecord_(row, context, 'status'), replayed: true, auditPending: replayAuditPending };
    }
    var now = portalNow_();
    if (input.id) {
      if (!row) throw portalApiError_('not_found');
      if (portalNumber_(row.revision, 0) !== input.revision) throw portalApiError_('revision_conflict');
    } else {
      row = { statusId: operation.entityId, officeId: context.officeId, createdAt: now, revision: 0 };
    }
    row.location = input.location;
    row.category = input.category;
    row.state = input.state;
    row.summary = input.summary;
    row.visibility = input.visibility;
    row.updatedAt = now;
    row.updatedBy = context.userId;
    row.revision = portalNumber_(row.revision, 0) + 1;
    portalSaveRow_('ManagementStatus', row);
    var auditPending = portalFinishOperation_(operation, input.id ? 'updated' : 'created');
    return { status: portalPureProjectRecord_(row, context, 'status'), replayed: started.replayed, auditPending: auditPending };
  });
}

function portalLogList_(context, payload) {
  portalRequirePermission_(context, 'logs.view');
  var limit = portalPureLimit_(payload.limit, 100, 200);
  var items = portalVisibleRecords_('ManagementLogs', context, 'log');
  if (payload.category) items = items.filter(function (row) { return row.category === payload.category; });
  items.sort(function (a, b) {
    return String(b.workDate + '|' + b.updatedAt).localeCompare(String(a.workDate + '|' + a.updatedAt));
  });
  return { logs: items.slice(0, limit) };
}

function portalLogSave_(context, payload) {
  portalRequirePermission_(context, 'logs.manage');
  var source = payload.log || payload;
  var requestId = portalPureRequestId_(payload.requestId || source.requestId);
  var input = portalPureRecordInput_({
    id: source.logId,
    workDate: source.workDate,
    category: source.category,
    title: source.title,
    content: source.content,
    visibility: source.visibility,
    revision: source.revision
  }, 'log');
  var inputHash = portalInputHash_({ kind: 'log', input: input });
  return portalWithLock_(function () {
    var started = portalBeginOperation_(context, requestId, 'portalLogSave', 'log',
      input.id || portalRandomId_('log'), inputHash, context.officeId);
    var operation = started.operation;
    var row = portalRows_('ManagementLogs').filter(function (item) {
      return item.logId === operation.entityId && item.officeId === context.officeId;
    })[0];
    if (started.replayed && row && (operation.status !== 'started' || !input.id ||
        (portalNumber_(row.revision, 0) === input.revision + 1 && row.workDate === input.workDate &&
         row.category === input.category && row.title === input.title && row.content === input.content &&
         row.visibility === input.visibility))) {
      var replayAuditPending = portalFinishOperation_(operation, input.id ? 'updated' : 'created');
      return { log: portalPureProjectRecord_(row, context, 'log'), replayed: true, auditPending: replayAuditPending };
    }
    var now = portalNow_();
    if (input.id) {
      if (!row) throw portalApiError_('not_found');
      if (portalNumber_(row.revision, 0) !== input.revision) throw portalApiError_('revision_conflict');
    } else {
      row = { logId: operation.entityId, officeId: context.officeId, createdAt: now, revision: 0 };
    }
    row.workDate = input.workDate;
    row.category = input.category;
    row.title = input.title;
    row.content = input.content;
    row.visibility = input.visibility;
    row.updatedAt = now;
    row.updatedBy = context.userId;
    row.revision = portalNumber_(row.revision, 0) + 1;
    portalSaveRow_('ManagementLogs', row);
    var auditPending = portalFinishOperation_(operation, input.id ? 'updated' : 'created');
    return { log: portalPureProjectRecord_(row, context, 'log'), replayed: started.replayed, auditPending: auditPending };
  });
}

function portalToday_() {
  try { return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd'); }
  catch (ignored) { return new Date().toISOString().slice(0, 10); }
}

function portalProjectWorkOrder_(row, context, assigneeNames) {
  if (!portalPureCanSeeRecord_(row, context)) return null;
  return {
    workOrderId: row.workOrderId, receiptNo: row.receiptNo || '', title: row.title,
    location: row.location, category: row.category, priority: row.priority, status: row.status,
    assigneeUserId: row.assigneeUserId || '',
    assigneeName: row.assigneeUserId && assigneeNames ? String(assigneeNames[row.assigneeUserId] || '') : '',
    dueDate: row.dueDate || '', instructions: row.instructions,
    visibility: row.visibility, createdAt: row.createdAt, updatedAt: row.updatedAt,
    revision: portalNumber_(row.revision, 0)
  };
}

function portalStaffUsers_(officeId) {
  return portalRows_('Users').filter(function (user) {
    return user.officeId === officeId && portalTruth_(user.enabled) && portalPureIsStaff_(user.role);
  });
}

function portalAssigneeNames_(officeId, staffUsers) {
  var assigneeNames = {};
  (staffUsers || portalStaffUsers_(officeId)).forEach(function (user) {
    assigneeNames[user.userId] = user.displayName;
  });
  return assigneeNames;
}

function portalVisibleWorkOrders_(context, staffUsers) {
  var assigneeNames = portalAssigneeNames_(context.officeId, staffUsers);
  return portalRows_('WorkOrders').filter(function (row) {
    return row.officeId === context.officeId && portalPureCanSeeRecord_(row, context);
  }).map(function (row) { return portalProjectWorkOrder_(row, context, assigneeNames); });
}

function portalWorkOrderList_(context, payload) {
  portalRequirePermission_(context, 'workorders.view');
  var limit = portalPureLimit_(payload.limit, 100, 200);
  var staffUsers = portalStaffUsers_(context.officeId);
  var items = portalVisibleWorkOrders_(context, staffUsers);
  if (payload.status) items = items.filter(function (row) { return row.status === payload.status; });
  items.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  var result = { workOrders: items.slice(0, limit) };
  if (portalPureCan_(context.permissions, 'workorders.assign')) {
    result.assignees = staffUsers.map(function (user) {
      return { id: user.userId, name: user.displayName, role: user.role };
    });
  }
  return result;
}

function portalValidateWorkOrderMutation_(context, input, row) {
  if (input.workOrderId) {
    if (!row) throw portalApiError_('not_found');
    if (portalNumber_(row.revision, 0) !== input.revision) throw portalApiError_('revision_conflict');
    if (row.status === 'completed' || row.status === 'cancelled') throw portalApiError_('invalid_transition');
    if (!portalPureWorkOrderTransitionAllowed_(row.status, input.status)) throw portalApiError_('invalid_transition');
  } else if (!portalPureWorkOrderTransitionAllowed_('', input.status)) {
    throw portalApiError_('invalid_transition');
  }
  var assigneeChanged = (!row && input.assigneeUserId) ||
    (row && String(row.assigneeUserId || '') !== input.assigneeUserId);
  if (!assigneeChanged) return;
  portalRequirePermission_(context, 'workorders.assign');
  if (input.assigneeUserId) {
    var assignee = portalUserById_(input.assigneeUserId);
    if (!assignee || assignee.officeId !== context.officeId || !portalTruth_(assignee.enabled) ||
        !portalPureIsStaff_(assignee.role)) throw portalApiError_('invalid_assignee');
  }
}

function portalWorkOrderSave_(context, payload) {
  portalRequirePermission_(context, 'workorders.manage');
  var source = payload.workOrder || payload;
  var requestId = portalPureRequestId_(payload.requestId || source.requestId);
  var assigneeSpecified = Object.prototype.hasOwnProperty.call(source, 'assigneeUserId');
  var input = portalPureWorkOrderInput_(source);
  var hashInput = JSON.parse(JSON.stringify(input));
  if (!assigneeSpecified) delete hashInput.assigneeUserId;
  var inputHash = portalInputHash_({
    kind: 'workorder', input: hashInput, assigneeMode: assigneeSpecified ? 'replace' : 'preserve'
  });
  return portalWithLock_(function () {
    var knownOperation = portalOperationByRequestId_(requestId);
    var existing = input.workOrderId ? portalRows_('WorkOrders').filter(function (item) {
      return item.workOrderId === input.workOrderId && item.officeId === context.officeId;
    })[0] : null;
    if (existing && !assigneeSpecified) input.assigneeUserId = String(existing.assigneeUserId || '');
    if (!knownOperation) portalValidateWorkOrderMutation_(context, input, existing);
    var started = portalBeginOperation_(context, requestId, 'portalWorkOrderSave', 'workorder',
      input.workOrderId || portalRandomId_('wrk'), inputHash, context.officeId, knownOperation);
    var operation = started.operation;
    var row = portalRows_('WorkOrders').filter(function (item) {
      return item.workOrderId === operation.entityId && item.officeId === context.officeId;
    })[0];
    var workOrderMatches = row && portalNumber_(row.revision, 0) === input.revision + 1 &&
      String(row.receiptNo || '') === input.receiptNo && row.title === input.title && row.location === input.location &&
      row.category === input.category && row.priority === input.priority && row.status === input.status &&
      String(row.assigneeUserId || '') === input.assigneeUserId && String(row.dueDate || '') === input.dueDate &&
      row.instructions === input.instructions && row.visibility === input.visibility;
    if (started.replayed && row && (operation.status !== 'started' || workOrderMatches)) {
      var replayPending = portalFinishOperation_(operation, input.workOrderId ? 'updated' : 'created');
      return { workOrder: portalProjectWorkOrder_(row, context, portalAssigneeNames_(context.officeId)), replayed: true, auditPending: replayPending };
    }
    if (knownOperation) portalValidateWorkOrderMutation_(context, input, row);
    var now = portalNow_();
    if (!row) row = { workOrderId: operation.entityId, officeId: context.officeId, createdAt: now, revision: 0 };
    row.receiptNo = input.receiptNo; row.title = input.title; row.location = input.location;
    row.category = input.category; row.priority = input.priority; row.status = input.status;
    row.assigneeUserId = input.assigneeUserId; row.dueDate = input.dueDate;
    row.instructions = input.instructions; row.visibility = input.visibility;
    row.updatedAt = now; row.updatedBy = context.userId; row.revision = portalNumber_(row.revision, 0) + 1;
    portalSaveRow_('WorkOrders', row);
    var auditPending = portalFinishOperation_(operation, input.workOrderId ? 'updated' : 'created');
    return { workOrder: portalProjectWorkOrder_(row, context, portalAssigneeNames_(context.officeId)), replayed: started.replayed, auditPending: auditPending };
  });
}

function portalNoticeVisible_(row, context, today) {
  if (!portalPureCanSeeRecord_(row, context)) return false;
  if (portalPureIsStaff_(context.role)) return true;
  if (row.state !== 'published') return false;
  if (row.publishDate && row.publishDate > today) return false;
  if (row.expiresDate && row.expiresDate < today) return false;
  return true;
}

function portalProjectNotice_(row) {
  return {
    noticeId: row.noticeId, title: row.title, content: row.content, visibility: row.visibility,
    state: row.state, publishDate: row.publishDate || '', expiresDate: row.expiresDate || '',
    createdAt: row.createdAt, updatedAt: row.updatedAt, revision: portalNumber_(row.revision, 0)
  };
}

function portalVisibleNotices_(context) {
  var today = portalToday_();
  return portalRows_('Notices').filter(function (row) {
    return row.officeId === context.officeId && portalNoticeVisible_(row, context, today);
  }).map(portalProjectNotice_);
}

function portalNoticeList_(context, payload) {
  portalRequirePermission_(context, 'notices.view');
  var items = portalVisibleNotices_(context);
  items.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return { notices: items.slice(0, portalPureLimit_(payload.limit, 100, 200)) };
}

function portalValidateNoticeMutation_(context, input, row) {
  if (input.noticeId) {
    if (!row) throw portalApiError_('not_found');
    if (portalNumber_(row.revision, 0) !== input.revision) throw portalApiError_('revision_conflict');
    if (row.state === 'archived') throw portalApiError_('invalid_transition');
    if (row.state === 'published') portalRequirePermission_(context, 'notices.publish');
  }
  if (!portalPureNoticeTransitionAllowed_(row ? row.state : '', input.state)) {
    throw portalApiError_('invalid_transition');
  }
  if (input.state === 'published' && (!row || row.state !== 'published')) {
    portalRequirePermission_(context, 'notices.publish');
  }
}

function portalNoticeSave_(context, payload) {
  portalRequirePermission_(context, 'notices.manage');
  var source = payload.notice || payload;
  var requestId = portalPureRequestId_(payload.requestId || source.requestId);
  var input = portalPureNoticeInput_(source);
  var inputHash = portalInputHash_({ kind: 'notice', input: input });
  return portalWithLock_(function () {
    var knownOperation = portalOperationByRequestId_(requestId);
    var existing = input.noticeId ? portalRows_('Notices').filter(function (item) {
      return item.noticeId === input.noticeId && item.officeId === context.officeId;
    })[0] : null;
    if (!knownOperation) portalValidateNoticeMutation_(context, input, existing);
    var started = portalBeginOperation_(context, requestId, 'portalNoticeSave', 'notice',
      input.noticeId || portalRandomId_('ntc'), inputHash, context.officeId, knownOperation);
    var operation = started.operation;
    var row = portalRows_('Notices').filter(function (item) {
      return item.noticeId === operation.entityId && item.officeId === context.officeId;
    })[0];
    var noticeMatches = row && portalNumber_(row.revision, 0) === input.revision + 1 &&
      row.title === input.title && row.content === input.content && row.visibility === input.visibility &&
      row.state === input.state && String(row.publishDate || '') === input.publishDate &&
      String(row.expiresDate || '') === input.expiresDate;
    if (started.replayed && row && (operation.status !== 'started' || noticeMatches)) {
      var replayPending = portalFinishOperation_(operation, input.noticeId ? 'updated' : 'created');
      return { notice: portalProjectNotice_(row), replayed: true, auditPending: replayPending };
    }
    if (knownOperation) portalValidateNoticeMutation_(context, input, row);
    var now = portalNow_();
    if (!row) row = { noticeId: operation.entityId, officeId: context.officeId, createdAt: now, revision: 0 };
    row.title = input.title; row.content = input.content; row.visibility = input.visibility;
    row.state = input.state; row.publishDate = input.publishDate; row.expiresDate = input.expiresDate;
    row.updatedAt = now; row.updatedBy = context.userId; row.revision = portalNumber_(row.revision, 0) + 1;
    portalSaveRow_('Notices', row);
    var auditPending = portalFinishOperation_(operation, input.noticeId ? 'updated' : 'created');
    return { notice: portalProjectNotice_(row), replayed: started.replayed, auditPending: auditPending };
  });
}

function portalProjectCost_(row) {
  return {
    costId: row.costId, workOrderId: row.workOrderId || '', category: row.category,
    description: row.description, amountKrw: portalNumber_(row.amountKrw, 0), taxMode: row.taxMode,
    status: row.status, approvedBy: row.approvedBy || '', approvedAt: row.approvedAt || '',
    createdAt: row.createdAt, updatedAt: row.updatedAt, revision: portalNumber_(row.revision, 0)
  };
}

function portalCostList_(context, payload) {
  portalRequirePermission_(context, 'costs.view');
  var items = portalRows_('CostItems').filter(function (row) { return row.officeId === context.officeId; })
    .map(portalProjectCost_);
  items.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return { costs: items.slice(0, portalPureLimit_(payload.limit, 100, 200)) };
}

function portalValidateCostMutation_(context, input, row) {
  if (input.costId) {
    if (!row) throw portalApiError_('not_found');
    if (portalNumber_(row.revision, 0) !== input.revision) throw portalApiError_('revision_conflict');
    /* 승인 요청 이후 원문 변경은 금지한다. 취소 후 새 비용으로 다시 제출해야 한다. */
    if (row.status !== 'draft') throw portalApiError_('invalid_transition');
  }
  if (input.workOrderId) {
    var linked = portalRows_('WorkOrders').some(function (item) {
      return item.workOrderId === input.workOrderId && item.officeId === context.officeId;
    });
    if (!linked) throw portalApiError_('not_found');
  }
}

function portalCostSave_(context, payload) {
  portalRequirePermission_(context, 'costs.manage');
  var source = payload.cost || payload;
  var requestId = portalPureRequestId_(payload.requestId || source.requestId);
  var input = portalPureCostInput_(source);
  var inputHash = portalInputHash_({ kind: 'cost', input: input });
  return portalWithLock_(function () {
    var knownOperation = portalOperationByRequestId_(requestId);
    var existing = input.costId ? portalRows_('CostItems').filter(function (item) {
      return item.costId === input.costId && item.officeId === context.officeId;
    })[0] : null;
    if (!knownOperation) portalValidateCostMutation_(context, input, existing);
    var started = portalBeginOperation_(context, requestId, 'portalCostSave', 'cost',
      input.costId || portalRandomId_('cst'), inputHash, context.officeId, knownOperation);
    var operation = started.operation;
    var row = portalRows_('CostItems').filter(function (item) {
      return item.costId === operation.entityId && item.officeId === context.officeId;
    })[0];
    var costMatches = row && portalNumber_(row.revision, 0) === input.revision + 1 &&
      String(row.workOrderId || '') === input.workOrderId && row.category === input.category &&
      row.description === input.description && portalNumber_(row.amountKrw, 0) === input.amountKrw &&
      row.taxMode === input.taxMode && row.status === input.status;
    if (started.replayed && row && (operation.status !== 'started' || costMatches)) {
      var replayPending = portalFinishOperation_(operation, input.costId ? 'updated' : 'created');
      return { cost: portalProjectCost_(row), replayed: true, auditPending: replayPending };
    }
    if (knownOperation) portalValidateCostMutation_(context, input, row);
    var now = portalNow_();
    if (!row) row = { costId: operation.entityId, officeId: context.officeId, createdAt: now, approvedBy: '', approvedAt: '', revision: 0 };
    row.workOrderId = input.workOrderId; row.category = input.category; row.description = input.description;
    row.amountKrw = input.amountKrw; row.taxMode = input.taxMode; row.status = input.status;
    row.updatedAt = now; row.updatedBy = context.userId; row.revision = portalNumber_(row.revision, 0) + 1;
    portalSaveRow_('CostItems', row);
    var auditPending = portalFinishOperation_(operation, input.costId ? 'updated' : 'created');
    return { cost: portalProjectCost_(row), replayed: started.replayed, auditPending: auditPending };
  });
}

function portalCostApprove_(context, payload) {
  portalRequirePermission_(context, 'costs.approve');
  var requestId = portalPureRequestId_(payload.requestId);
  var costId = portalPureId_(payload.costId, 'costId');
  var nextStatus = portalPureEnum_(payload.targetState, 'targetState', ['approved', 'paid', 'cancelled']);
  var revision = portalPureRevision_(payload.revision);
  var inputHash = portalInputHash_({ kind: 'costApprove', costId: costId, status: nextStatus, revision: revision });
  return portalWithLock_(function () {
    var knownOperation = portalOperationByRequestId_(requestId);
    var existing = portalRows_('CostItems').filter(function (item) {
      return item.costId === costId && item.officeId === context.officeId;
    })[0];
    if (!knownOperation) {
      if (!existing) throw portalApiError_('not_found');
      if (portalNumber_(existing.revision, 0) !== revision) throw portalApiError_('revision_conflict');
      if (!portalPureCostTransitionAllowed_(existing.status, nextStatus)) throw portalApiError_('invalid_transition');
    }
    var started = portalBeginOperation_(context, requestId, 'portalCostApprove', 'cost', costId, inputHash,
      context.officeId, knownOperation);
    var operation = started.operation;
    var row = portalRows_('CostItems').filter(function (item) {
      return item.costId === costId && item.officeId === context.officeId;
    })[0];
    var transitionMatches = row && row.status === nextStatus && portalNumber_(row.revision, 0) === revision + 1;
    if (started.replayed && row && (operation.status !== 'started' || transitionMatches)) {
      var replayPending = portalFinishOperation_(operation, 'transitioned');
      return { cost: portalProjectCost_(row), replayed: true, auditPending: replayPending };
    }
    if (knownOperation) {
      if (!row) throw portalApiError_('not_found');
      if (portalNumber_(row.revision, 0) !== revision) throw portalApiError_('revision_conflict');
      if (!portalPureCostTransitionAllowed_(row.status, nextStatus)) throw portalApiError_('invalid_transition');
    }
    var now = portalNow_();
    row.status = nextStatus; row.updatedAt = now; row.updatedBy = context.userId;
    if (nextStatus === 'approved') { row.approvedBy = context.userId; row.approvedAt = now; }
    row.revision = portalNumber_(row.revision, 0) + 1;
    portalSaveRow_('CostItems', row);
    var auditPending = portalFinishOperation_(operation, 'transitioned');
    return { cost: portalProjectCost_(row), replayed: started.replayed, auditPending: auditPending };
  });
}

function portalCountBy_(items, field) {
  var counts = {};
  items.forEach(function (item) { var key = String(item[field] || 'unknown'); counts[key] = (counts[key] || 0) + 1; });
  return counts;
}

function portalReportDate_(value) {
  var text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  var stamp = new Date(text).getTime();
  if (!isFinite(stamp)) return '';
  /* 현장 운영 기준은 Asia/Seoul(+09:00)이며 한국은 일광절약시간을 사용하지 않는다. */
  return new Date(stamp + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function portalCostGrossAmount_(row) {
  var amount = portalNumber_(row.amountKrw, 0);
  return String(row.taxMode || '') === 'excluded' ? Math.round(amount * 1.1) : amount;
}

function portalReportSummary_(context, payload) {
  portalRequirePermission_(context, 'reports.view');
  var startDate = portalPureIsoDate_(payload.startDate, 'startDate');
  var endDate = portalPureIsoDate_(payload.endDate, 'endDate');
  var span = (new Date(endDate + 'T00:00:00.000Z').getTime() - new Date(startDate + 'T00:00:00.000Z').getTime()) / 86400000;
  if (span < 0 || span > 365) throw portalApiError_('invalid_date_range');
  function inRange(value) { var date = portalReportDate_(value); return date >= startDate && date <= endDate; }
  var statuses = portalPureCan_(context.permissions, 'status.view') ?
    portalVisibleRecords_('ManagementStatus', context, 'status').filter(function (row) { return inRange(row.updatedAt); }) : [];
  var logs = portalPureCan_(context.permissions, 'logs.view') ?
    portalVisibleRecords_('ManagementLogs', context, 'log').filter(function (row) { return inRange(row.workDate); }) : [];
  /* reports.view authorizes aggregate counts; row visibility still filters board/public/internal scope. */
  var workOrders = portalVisibleWorkOrders_(context, []).filter(function (row) { return inRange(row.updatedAt); });
  var notices = portalPureCan_(context.permissions, 'notices.view') ?
    portalVisibleNotices_(context).filter(function (row) { return inRange(row.publishDate || row.updatedAt); }) : [];
  var result = {
    startDate: startDate, endDate: endDate,
    counts: { statuses: statuses.length, logs: logs.length, workOrders: workOrders.length, notices: notices.length },
    statusByState: portalCountBy_(statuses, 'state'), workOrdersByStatus: portalCountBy_(workOrders, 'status'),
    noticesByState: portalCountBy_(notices, 'state')
  };
  if (portalPureCan_(context.permissions, 'costs.view')) {
    var costs = portalRows_('CostItems').filter(function (row) { return row.officeId === context.officeId && inRange(row.updatedAt); });
    var amountByStatus = {}, total = 0, pendingTotal = 0, approvedUnpaidTotal = 0, paidTotal = 0;
    costs.forEach(function (row) {
      var amount = portalCostGrossAmount_(row), status = String(row.status || 'unknown');
      if (status !== 'cancelled') total += amount;
      if (status === 'draft' || status === 'submitted') pendingTotal += amount;
      if (status === 'approved') approvedUnpaidTotal += amount;
      if (status === 'paid') paidTotal += amount;
      amountByStatus[status] = (amountByStatus[status] || 0) + amount;
    });
    result.counts.costs = costs.length;
    result.totalAmountKrw = total;
    result.pendingAmountKrw = pendingTotal;
    result.approvedUnpaidAmountKrw = approvedUnpaidTotal;
    result.paidAmountKrw = paidTotal;
    result.amountKrwByStatus = amountByStatus;
  }
  return { report: result };
}

function portalTargetOffice_(context, payload) {
  var requested = payload && payload.officeId ? portalPureId_(payload.officeId, 'officeId') : context.officeId;
  if (context.role !== 'system_admin' && requested !== context.officeId) {
    throw portalApiError_('office_scope_denied');
  }
  var office = portalOfficeById_(requested);
  if (!office) throw portalApiError_('office_not_found');
  return office;
}

function portalUserList_(context, payload) {
  portalRequirePermission_(context, 'admin.users.view');
  var office = portalTargetOffice_(context, payload);
  var overridesByUser = {};
  portalRows_('RolePermissions').forEach(function (row) {
    if (row.officeId !== office.officeId || PORTAL_VIEW_CAPABILITIES.indexOf(row.capability) === -1) return;
    var key = row.userId + '|' + row.role;
    if (!overridesByUser[key]) overridesByUser[key] = [];
    overridesByUser[key].push({ capability: row.capability, allowed: portalTruth_(row.allowed) });
  });
  var users = portalRows_('Users').filter(function (row) {
    return row.officeId === office.officeId;
  }).map(function (row) {
    return portalPresentUser_(row, true, overridesByUser[row.userId + '|' + row.role] || []);
  });
  users.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  return { office: portalPresentOffice_(office), users: users };
}

function portalCountActiveRole_(role, officeId) {
  return portalRows_('Users').filter(function (row) {
    return row.role === role && portalTruth_(row.enabled) && (!officeId || row.officeId === officeId);
  }).length;
}

function portalAssertCanManageUser_(context, target, next) {
  if (context.role !== 'system_admin') {
    if (target && target.officeId !== context.officeId) throw portalApiError_('office_scope_denied');
    if ((target && target.role === 'system_admin') || next.role === 'system_admin') {
      throw portalApiError_('protected_admin');
    }
  }
  if (target && target.userId === context.userId) {
    if (!next.active || next.role !== target.role || next.email !== target.email) {
      throw portalApiError_('self_lockout_prevented');
    }
  }
  if (target && portalTruth_(target.enabled)) {
    var removesSystemAdmin = target.role === 'system_admin' && (!next.active || next.role !== 'system_admin');
    if (removesSystemAdmin && portalCountActiveRole_('system_admin', '') <= 1) {
      throw portalApiError_('last_system_admin');
    }
    var removesChief = target.role === 'manager_chief' && (!next.active || next.role !== 'manager_chief');
    if (removesChief && portalCountActiveRole_('manager_chief', target.officeId) <= 1) {
      throw portalApiError_('last_manager_chief');
    }
  }
}

function portalUpsertOfficeForSystemAdmin_(context, input) {
  if (context.role !== 'system_admin') throw portalApiError_('forbidden');
  var officeInput = portalPureOfficeInput_(input);
  var offices = portalRows_('Offices');
  var office = offices.filter(function (row) { return row.officeId === officeInput.officeId; })[0];
  var duplicateSlug = offices.filter(function (row) {
    return row.officeId !== officeInput.officeId && String(row.slug).toLowerCase() === officeInput.slug;
  })[0];
  if (duplicateSlug) throw portalApiError_('duplicate_office_slug');
  var now = portalNow_();
  if (!office) {
    office = {
      officeId: officeInput.officeId,
      permissionVersion: 1,
      createdAt: now
    };
  } else {
    if (office.officeId === context.officeId && !officeInput.enabled) {
      throw portalApiError_('self_lockout_prevented');
    }
    office.permissionVersion = portalNumber_(office.permissionVersion, 0) + 1;
  }
  office.slug = officeInput.slug;
  office.complexName = officeInput.complexName;
  office.enabled = officeInput.enabled;
  office.updatedAt = now;
  portalSaveRow_('Offices', office);
  return office;
}

function portalUserSave_(context, payload) {
  portalRequirePermission_(context, 'admin.users.manage');
  var source = payload.user || payload;
  var requestId = portalPureRequestId_(payload.requestId || source.requestId);
  var input = portalPureUserInput_(source);
  var officeInput = payload.office ? portalPureOfficeInput_(payload.office) : null;
  var requestedOfficeId = officeInput ? officeInput.officeId :
    (payload.officeId ? portalPureId_(payload.officeId, 'officeId') : context.officeId);
  var inputHash = portalInputHash_({ kind: 'user', input: input, office: officeInput || requestedOfficeId });
  return portalWithLock_(function () {
    var office = officeInput ? portalOfficeById_(officeInput.officeId) : portalTargetOffice_(context, payload);
    var started = portalBeginOperation_(context, requestId, 'portalUserSave', 'user',
      input.userId || portalRandomId_('usr'), inputHash, requestedOfficeId);
    var operation = started.operation;
    var users = portalRows_('Users');
    var target = users.filter(function (row) { return row.userId === operation.entityId; })[0] || null;
    var replayMatches = target && target.email === input.email && target.displayName === input.name &&
      target.role === input.role && String(target.unit || '') === input.unit && portalTruth_(target.enabled) === input.active;
    if (started.replayed && target && (operation.status !== 'started' || !input.userId || replayMatches)) {
      var replayOffice = portalOfficeById_(target.officeId);
      if (!replayOffice) throw portalApiError_('office_not_found');
      var replayAuditPending = portalFinishOperation_(operation, input.userId ? 'updated' : 'created');
      return {
        user: portalPresentUser_(target, true), office: portalPresentOffice_(replayOffice),
        replayed: true, auditPending: replayAuditPending
      };
    }
    if (officeInput) office = portalUpsertOfficeForSystemAdmin_(context, officeInput);
    if (input.userId && !target) throw portalApiError_('user_not_found');
    if (target && target.officeId !== office.officeId) throw portalApiError_('office_scope_denied');
    portalAssertCanManageUser_(context, target, input);
    var emailHash = portalHmac_('OFFICE_PORTAL_OTP_PEPPER', input.email);
    var duplicate = users.filter(function (row) {
      return row.officeId === office.officeId && row.emailHash === emailHash && (!target || row.userId !== target.userId);
    })[0];
    if (duplicate) throw portalApiError_('duplicate_email');

    var now = portalNow_();
    var row = target || {
      userId: operation.entityId,
      officeId: office.officeId,
      createdAt: now,
      lastLoginAt: '',
      sessionVersion: 0,
      permissionVersion: 0
    };
    if (target && target.emailHash !== emailHash) {
      portalRows_('OtpChallenges').filter(function (challenge) {
        return challenge.userId === target.userId && !challenge.usedAt && !challenge.revokedAt;
      }).forEach(function (challenge) {
        challenge.revokedAt = now;
        portalSaveRow_('OtpChallenges', challenge);
      });
    }
    row.email = input.email;
    row.emailHash = emailHash;
    row.displayName = input.name;
    row.role = input.role;
    row.unit = input.unit;
    row.enabled = input.active;
    row.updatedAt = now;
    if (target) {
      row.sessionVersion = portalNumber_(row.sessionVersion, 0) + 1;
      row.permissionVersion = portalNumber_(row.permissionVersion, 0) + 1;
    }
    portalSaveRow_('Users', row);
    var auditPending = portalFinishOperation_(operation, target ? 'updated' : 'created');
    return {
      user: portalPresentUser_(row, true), office: portalPresentOffice_(office),
      replayed: started.replayed, auditPending: auditPending
    };
  });
}

function portalAssertCanChangePermissions_(context, target, permissions) {
  if (target.userId === context.userId) throw portalApiError_('self_lockout_prevented');
  if (context.role !== 'system_admin') {
    if (target.officeId !== context.officeId) throw portalApiError_('office_scope_denied');
    if (target.role === 'system_admin' || target.role === 'manager_chief') {
      throw portalApiError_('protected_admin');
    }
  }
}

function portalPermissionSave_(context, payload) {
  portalRequirePermission_(context, 'admin.permissions.manage');
  var requestId = portalPureRequestId_(payload.requestId);
  var userId = portalPureId_(payload.userId, 'userId');
  return portalWithLock_(function () {
    var target = portalUserById_(userId);
    if (!target) throw portalApiError_('user_not_found');
    if (context.role !== 'system_admin' && target.officeId !== context.officeId) {
      throw portalApiError_('office_scope_denied');
    }
    var permissions = portalPurePermissionSet_(target.role, payload.permissions);
    portalAssertCanChangePermissions_(context, target, permissions);
    var inputHash = portalInputHash_({ kind: 'permissions', userId: userId, permissions: permissions });
    var started = portalBeginOperation_(context, requestId, 'portalPermissionSave', 'user_permissions',
      target.userId, inputHash, target.officeId);
    var operation = started.operation;
    var ceiling = PORTAL_ROLE_CEILINGS[target.role].filter(function (capability) {
      return PORTAL_VIEW_CAPABILITIES.indexOf(capability) !== -1;
    });
    var existing = portalRows_('RolePermissions');
    if (started.replayed && operation.status !== 'started') {
      var replayAuditPending = portalFinishOperation_(operation, 'updated');
      return { user: portalPresentUser_(target, true), replayed: true, auditPending: replayAuditPending };
    }
    var now = portalNow_();
    ceiling.forEach(function (capability) {
      var row = existing.filter(function (item) {
        return item.officeId === target.officeId && item.userId === target.userId &&
          item.role === target.role && item.capability === capability;
      })[0] || {
        officeId: target.officeId,
        userId: target.userId,
        role: target.role,
        capability: capability
      };
      row.allowed = permissions.indexOf(capability) !== -1;
      row.updatedAt = now;
      row.updatedBy = context.userId;
      portalSaveRow_('RolePermissions', row);
    });
    target.permissionVersion = portalNumber_(target.permissionVersion, 0) + 1;
    target.updatedAt = now;
    portalSaveRow_('Users', target);
    var auditPending = portalFinishOperation_(operation, 'updated');
    return { user: portalPresentUser_(target, true), replayed: started.replayed, auditPending: auditPending };
  });
}

function portalAuditList_(context, payload) {
  portalRequirePermission_(context, 'admin.audit.view');
  var office = portalTargetOffice_(context, payload);
  var limit = portalPureLimit_(payload.limit, 100, 500);
  var userNames = {};
  portalRows_('Users').forEach(function (user) { userNames[user.userId] = user.displayName; });
  var items = portalRows_('PortalAudit').filter(function (row) {
    return row.officeId === office.officeId;
  }).map(function (row) {
    var item = portalPureSafeAudit_(row);
    item.actorName = userNames[row.actorUserId] || '시스템';
    return item;
  });
  items.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  return { audit: items.slice(0, limit), office: portalPresentOffice_(office) };
}

function portalLatestAuthTerminalTime_(row, now, includeUsedAt) {
  var terminalTimes = [];
  var expiresAt = portalTime_(row.expiresAt);
  if (isFinite(expiresAt) && expiresAt <= now) terminalTimes.push(expiresAt);
  if (includeUsedAt && row.usedAt) {
    var usedAt = portalTime_(row.usedAt);
    if (isFinite(usedAt)) terminalTimes.push(usedAt);
  }
  if (row.revokedAt) {
    var revokedAt = portalTime_(row.revokedAt);
    if (isFinite(revokedAt)) terminalTimes.push(revokedAt);
  }
  if (!terminalTimes.length) return NaN;
  return Math.max.apply(null, terminalTimes);
}

function portalDeleteRowsDescending_(sheetName, rows) {
  var sheet = portalSheet_(sheetName);
  rows.map(function (row) { return Number(row._row); })
    .filter(function (rowNumber) { return isFinite(rowNumber) && rowNumber >= 2; })
    .sort(function (left, right) { return right - left; })
    .forEach(function (rowNumber) { sheet.deleteRow(rowNumber); });
}

/*
 * Apps Script 편집기 또는 일일 시간 기반 트리거로만 실행하는 보관 정리.
 * 웹 action이 아니며 관리 상태·일지·감사 로그는 절대 삭제하지 않는다.
 */
function portalPruneExpiredAuthRows_() {
  return portalWithLock_(function () {
    var now = Date.now();
    var otpCutoff = now - PORTAL_OTP_RETENTION_MS;
    var sessionCutoff = now - PORTAL_SESSION_RETENTION_MS;
    var operationCutoff = now - PORTAL_OPERATION_RETENTION_MS;
    var otpRows = portalRows_('OtpChallenges').filter(function (row) {
      var terminalAt = portalLatestAuthTerminalTime_(row, now, true);
      return isFinite(terminalAt) && terminalAt <= otpCutoff;
    });
    var sessionRows = portalRows_('Sessions').filter(function (row) {
      var terminalAt = portalLatestAuthTerminalTime_(row, now, false);
      return isFinite(terminalAt) && terminalAt <= sessionCutoff;
    });
    var operationRows = portalRows_('PortalOperations').filter(function (row) {
      var updatedAt = portalTime_(row.updatedAt);
      return row.status === 'complete' && isFinite(updatedAt) && updatedAt <= operationCutoff;
    });
    portalDeleteRowsDescending_('OtpChallenges', otpRows);
    portalDeleteRowsDescending_('Sessions', sessionRows);
    portalDeleteRowsDescending_('PortalOperations', operationRows);
    return {
      otpChallengesDeleted: otpRows.length,
      sessionsDeleted: sessionRows.length,
      operationsDeleted: operationRows.length,
      prunedAt: portalNow_()
    };
  });
}

/* 웹 action이 아닌 편집기/트리거 전용 audit 보완 함수. */
function portalRepairPendingOperationAudits_() {
  return portalWithLock_(function () {
    var repaired = 0;
    var pending = 0;
    portalRows_('PortalOperations').filter(function (operation) {
      return operation.status === 'audit_pending' || operation.status === 'primary_committed';
    }).forEach(function (operation) {
      try {
        portalAppendOperationAudit_(operation);
        operation.status = 'complete';
        operation.updatedAt = portalNow_();
        portalSaveRow_('PortalOperations', operation);
        repaired += 1;
      } catch (auditError) {
        pending += 1;
      }
    });
    return { repaired: repaired, pending: pending, repairedAt: portalNow_() };
  });
}

/* Apps Script 편집기에서 소유자가 한 번 실행하는 설치 함수. 웹 action이 아니다. */
function portalSetupSheets_() {
  var spreadsheet = portalSpreadsheet_();
  Object.keys(PORTAL_HEADERS).forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    var headers = PORTAL_HEADERS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else {
      var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      if (actual.join('\u001f') !== headers.join('\u001f')) throw portalApiError_('server_schema_error');
    }
  });
  return { schema: PORTAL_SCHEMA_VERSION, sheets: Object.keys(PORTAL_HEADERS).length };
}

/*
 * 최초 system_admin 생성. 값은 코드 인수가 아니라 임시 Script Properties에서 읽고,
 * 성공 시 임시 속성을 즉시 삭제한다. 이미 활성 system_admin이 있으면 거부한다.
 */
function portalBootstrapFromProperties_() {
  portalSetupSheets_();
  return portalWithLock_(function () {
    if (portalCountActiveRole_('system_admin', '') > 0) throw portalApiError_('bootstrap_already_completed');
    var props = portalProps_();
    var officeInput = portalPureOfficeInput_({
      officeId: props.getProperty('OFFICE_PORTAL_BOOTSTRAP_OFFICE_ID'),
      slug: props.getProperty('OFFICE_PORTAL_BOOTSTRAP_SLUG'),
      complexName: props.getProperty('OFFICE_PORTAL_BOOTSTRAP_COMPLEX_NAME'),
      enabled: true
    });
    var email = portalPureEmail_(props.getProperty('OFFICE_PORTAL_BOOTSTRAP_ADMIN_EMAIL'));
    var name = portalPureString_(String(props.getProperty('OFFICE_PORTAL_BOOTSTRAP_ADMIN_NAME') || ''), 'name', 1, 80, null);
    var now = portalNow_();
    var office = portalOfficeById_(officeInput.officeId) || {
      officeId: officeInput.officeId,
      createdAt: now,
      permissionVersion: 1
    };
    office.slug = officeInput.slug;
    office.complexName = officeInput.complexName;
    office.enabled = true;
    office.updatedAt = now;
    portalSaveRow_('Offices', office);
    var user = {
      userId: portalRandomId_('usr'),
      officeId: office.officeId,
      email: email,
      emailHash: portalHmac_('OFFICE_PORTAL_OTP_PEPPER', email),
      displayName: name,
      role: 'system_admin',
      unit: '',
      enabled: true,
      sessionVersion: 0,
      permissionVersion: 0,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: ''
    };
    portalSaveRow_('Users', user);
    portalAudit_({ officeId: office.officeId, userId: user.userId, role: 'system_admin' },
      'portalBootstrapFromProperties', 'user', user.userId, 'created');
    [
      'OFFICE_PORTAL_BOOTSTRAP_OFFICE_ID',
      'OFFICE_PORTAL_BOOTSTRAP_SLUG',
      'OFFICE_PORTAL_BOOTSTRAP_COMPLEX_NAME',
      'OFFICE_PORTAL_BOOTSTRAP_ADMIN_EMAIL',
      'OFFICE_PORTAL_BOOTSTRAP_ADMIN_NAME'
    ].forEach(function (key) { props.deleteProperty(key); });
    return { officeId: office.officeId, userId: user.userId };
  });
}

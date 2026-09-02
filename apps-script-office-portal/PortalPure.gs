/*
 * PortalPure.gs
 *
 * Google Apps Script API에 의존하지 않는 관리사무소 포털 권한·검증 규칙.
 * Code.gs와 Node VM 단위 테스트가 같은 규칙을 사용한다.
 */
'use strict';

var PORTAL_SCHEMA_VERSION = 'office-portal-v3';

var PORTAL_ROLES = Object.freeze([
  'system_admin',
  'manager_chief',
  'facility_manager',
  'resident_rep',
  'resident'
]);

var PORTAL_CAPABILITIES = Object.freeze([
  'dashboard.view',
  'status.view',
  'status.manage',
  'logs.view',
  'logs.manage',
  'requests.view',
  'reports.view',
  'notices.view',
  'notices.manage',
  'notices.publish',
  'costs.view',
  'costs.manage',
  'costs.approve',
  'workorders.view',
  'workorders.manage',
  'workorders.assign',
  'admin.users.view',
  'admin.users.manage',
  'admin.permissions.manage',
  'admin.audit.view'
]);

var PORTAL_VIEW_CAPABILITIES = Object.freeze(PORTAL_CAPABILITIES.filter(function (capability) {
  return /\.view$/.test(capability);
}));

var PORTAL_ROLE_CEILINGS = Object.freeze({
  system_admin: Object.freeze([
    'admin.users.view', 'admin.users.manage',
    'admin.permissions.manage', 'admin.audit.view'
  ]),
  manager_chief: Object.freeze(PORTAL_CAPABILITIES.slice()),
  facility_manager: Object.freeze([
    'dashboard.view',
    'status.view', 'status.manage',
    'logs.view', 'logs.manage',
    'requests.view', 'reports.view',
    'notices.view', 'notices.manage',
    'costs.view', 'costs.manage',
    'workorders.view', 'workorders.manage'
  ]),
  resident_rep: Object.freeze([
    'dashboard.view', 'status.view', 'logs.view', 'reports.view', 'notices.view'
  ]),
  resident: Object.freeze([
    'dashboard.view', 'status.view', 'logs.view', 'notices.view'
  ])
});

var PORTAL_ROLE_DEFAULTS = Object.freeze({
  system_admin: Object.freeze(PORTAL_ROLE_CEILINGS.system_admin.slice()),
  manager_chief: Object.freeze(PORTAL_ROLE_CEILINGS.manager_chief.slice()),
  facility_manager: Object.freeze(PORTAL_ROLE_CEILINGS.facility_manager.slice()),
  resident_rep: Object.freeze(PORTAL_ROLE_CEILINGS.resident_rep.slice()),
  resident: Object.freeze(PORTAL_ROLE_CEILINGS.resident.slice())
});

var PORTAL_VISIBILITIES = Object.freeze([
  'internal',
  'board',
  'public'
]);

var PORTAL_STATUS_STATES = Object.freeze([
  'normal', 'watch', 'repair', 'working', 'complete'
]);

var PORTAL_WORKORDER_PRIORITIES = Object.freeze(['low', 'normal', 'high', 'urgent']);
var PORTAL_WORKORDER_STATUSES = Object.freeze(['received', 'planned', 'working', 'blocked', 'completed', 'cancelled']);
var PORTAL_NOTICE_STATES = Object.freeze(['draft', 'published', 'archived']);
var PORTAL_COST_TAX_MODES = Object.freeze(['included', 'excluded', 'exempt']);
var PORTAL_COST_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'paid', 'cancelled']);

function portalPureError_(code, message) {
  var err = new Error(message || code);
  err.portalCode = code;
  return err;
}

function portalPureHas_(list, value) {
  return Array.isArray(list) && list.indexOf(value) !== -1;
}

function portalPureString_(value, field, min, max, pattern) {
  if (typeof value !== 'string') {
    throw portalPureError_('invalid_' + field, field + ' must be a string');
  }
  var text = value.trim();
  /*
   * Google Sheets treats leading =, +, -, and @ as formula-like input. Reject
   * them after trimming so a leading space cannot bypass the guard, and reject
   * raw leading line controls before trim removes them. Every externally
   * writable text field is normalized through this validator before storage.
   */
  if (/^[\t\r\n]/.test(value) || /^[=+\-@]/.test(text)) {
    throw portalPureError_('invalid_' + field, field + ' has an unsafe prefix');
  }
  if (text.length < min || text.length > max || (pattern && !pattern.test(text))) {
    throw portalPureError_('invalid_' + field, field + ' is invalid');
  }
  return text;
}

function portalPureOptionalString_(value, field, max) {
  if (value === undefined || value === null || value === '') return '';
  return portalPureString_(value, field, 1, max, null);
}

function portalPureBool_(value, field) {
  if (value !== true && value !== false) {
    throw portalPureError_('invalid_' + field, field + ' must be boolean');
  }
  return value;
}

function portalPureEmail_(value) {
  var email = portalPureString_(String(value || '').toLowerCase(), 'email', 3, 254, null);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw portalPureError_('invalid_email', 'email is invalid');
  }
  return email;
}

function portalPureLoginCode_(value, required) {
  if ((value === undefined || value === null || value === '') && !required) return '';
  return portalPureString_(String(value || ''), 'loginCode', 6, 6, /^\d{6}$/);
}

function portalPureSlug_(value) {
  return portalPureString_(String(value || '').toLowerCase(), 'slug', 3, 64, /^[a-z0-9][a-z0-9-]*$/);
}

function portalPureId_(value, field) {
  return portalPureString_(String(value || ''), field || 'id', 3, 96, /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
}

function portalPureRequestId_(value) {
  return portalPureString_(String(value || '').toLowerCase(), 'requestId', 36, 36,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
}

function portalPureRole_(value) {
  var role = portalPureString_(String(value || ''), 'role', 3, 32, /^[a-z_]+$/);
  if (!portalPureHas_(PORTAL_ROLES, role)) throw portalPureError_('invalid_role', 'role is invalid');
  return role;
}

function portalPureCapability_(value) {
  var capability = portalPureString_(String(value || ''), 'capability', 3, 64, /^[a-z]+(?:\.[a-z]+)+$/);
  if (!portalPureHas_(PORTAL_CAPABILITIES, capability)) {
    throw portalPureError_('invalid_capability', 'capability is invalid');
  }
  return capability;
}

function portalPureIsoDate_(value, field) {
  var text = portalPureString_(String(value || ''), field || 'date', 10, 10, /^\d{4}-\d{2}-\d{2}$/);
  var parsed = new Date(text + 'T00:00:00.000Z');
  if (!isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw portalPureError_('invalid_' + (field || 'date'), (field || 'date') + ' is invalid');
  }
  return text;
}

function portalPureOptionalIsoDate_(value, field) {
  if (value === undefined || value === null || value === '') return '';
  return portalPureIsoDate_(value, field);
}

function portalPureLimit_(value, fallback, max) {
  if (value === undefined || value === null || value === '') return fallback;
  var number = Number(value);
  if (!isFinite(number) || Math.floor(number) !== number || number < 1 || number > max) {
    throw portalPureError_('invalid_limit', 'limit is invalid');
  }
  return number;
}

function portalPureEffectivePermissions_(role, overrides) {
  role = portalPureRole_(role);
  var ceiling = PORTAL_ROLE_CEILINGS[role];
  var defaults = PORTAL_ROLE_DEFAULTS[role];
  var state = {};
  var i;
  for (i = 0; i < defaults.length; i += 1) state[defaults[i]] = true;
  (overrides || []).forEach(function (entry) {
    if (!entry || !portalPureHas_(ceiling, entry.capability)) return;
    if (entry.allowed === true || entry.allowed === false) state[entry.capability] = entry.allowed;
  });
  function requireView(viewCapability, dependentCapabilities) {
    if (state[viewCapability] === true) return;
    dependentCapabilities.forEach(function (capability) { state[capability] = false; });
  }
  requireView('status.view', ['status.manage']);
  requireView('logs.view', ['logs.manage']);
  requireView('workorders.view', ['workorders.manage', 'workorders.assign']);
  requireView('notices.view', ['notices.manage', 'notices.publish']);
  requireView('costs.view', ['costs.manage', 'costs.approve']);
  requireView('admin.users.view', ['admin.users.manage', 'admin.permissions.manage']);
  return ceiling.filter(function (capability) { return state[capability] === true; });
}

function portalPureEnum_(value, field, allowed) {
  var text = portalPureString_(String(value || ''), field, 2, 32, /^[a-z_]+$/);
  if (!portalPureHas_(allowed, text)) throw portalPureError_('invalid_' + field, field + ' is invalid');
  return text;
}

function portalPureRevision_(value) {
  var revision = value === undefined || value === null || value === '' ? 0 : Number(value);
  if (!isFinite(revision) || Math.floor(revision) !== revision || revision < 0) {
    throw portalPureError_('invalid_revision', 'revision is invalid');
  }
  return revision;
}

function portalPureVisibility_(value) {
  var visibility = portalPureString_(String(value || ''), 'visibility', 3, 16, /^[a-z_]+$/);
  if (!portalPureHas_(PORTAL_VISIBILITIES, visibility)) throw portalPureError_('invalid_visibility', 'visibility is invalid');
  return visibility;
}

function portalPureCan_(permissions, capability) {
  return portalPureHas_(permissions, capability);
}

function portalPureAssertPermission_(permissions, capability) {
  capability = portalPureCapability_(capability);
  if (!portalPureCan_(permissions, capability)) {
    throw portalPureError_('forbidden', 'permission denied');
  }
}

function portalPurePermissionSet_(role, permissions) {
  role = portalPureRole_(role);
  if (!Array.isArray(permissions)) {
    throw portalPureError_('invalid_permissions', 'permissions must be an array');
  }
  var seen = {};
  var ceiling = PORTAL_ROLE_CEILINGS[role];
  return permissions.map(function (value) {
    var capability = portalPureCapability_(value);
    if (!portalPureHas_(PORTAL_VIEW_CAPABILITIES, capability)) {
      throw portalPureError_('invalid_permissions', 'only view permissions can be overridden');
    }
    if (!portalPureHas_(ceiling, capability)) {
      throw portalPureError_('permission_ceiling', 'capability exceeds the role ceiling');
    }
    if (seen[capability]) throw portalPureError_('duplicate_permission', 'permission is duplicated');
    seen[capability] = true;
    return capability;
  });
}

function portalPureRecordInput_(input, kind) {
  input = input || {};
  var result = {
    id: input.id ? portalPureId_(input.id, kind + 'Id') : '',
    category: portalPureString_(String(input.category || ''), 'category', 1, 48, null),
    visibility: portalPureString_(String(input.visibility || ''), 'visibility', 3, 16, /^[a-z_]+$/),
    revision: input.revision === undefined || input.revision === null || input.revision === '' ? 0 : Number(input.revision)
  };
  if (!portalPureHas_(PORTAL_VISIBILITIES, result.visibility)) {
    throw portalPureError_('invalid_visibility', 'visibility is invalid');
  }
  if (!isFinite(result.revision) || Math.floor(result.revision) !== result.revision || result.revision < 0) {
    throw portalPureError_('invalid_revision', 'revision is invalid');
  }
  if (kind === 'status') {
    result.location = portalPureString_(String(input.location || ''), 'location', 1, 120, null);
    result.summary = portalPureString_(String(input.summary || ''), 'summary', 1, 2000, null);
    result.state = portalPureString_(String(input.state || ''), 'state', 3, 24, /^[a-z_]+$/);
    if (!portalPureHas_(PORTAL_STATUS_STATES, result.state)) {
      throw portalPureError_('invalid_state', 'state is invalid');
    }
  } else {
    result.workDate = portalPureIsoDate_(input.workDate, 'workDate');
    result.title = portalPureString_(String(input.title || ''), 'title', 2, 120, null);
    result.content = portalPureString_(String(input.content || ''), 'content', 1, 5000, null);
  }
  return result;
}

function portalPureWorkOrderInput_(input) {
  input = input || {};
  return {
    workOrderId: input.workOrderId ? portalPureId_(input.workOrderId, 'workOrderId') : '',
    receiptNo: portalPureOptionalString_(input.receiptNo, 'receiptNo', 80),
    title: portalPureString_(String(input.title || ''), 'title', 2, 120, null),
    location: portalPureString_(String(input.location || ''), 'location', 1, 120, null),
    category: portalPureString_(String(input.category || ''), 'category', 1, 48, null),
    priority: portalPureEnum_(input.priority, 'priority', PORTAL_WORKORDER_PRIORITIES),
    status: portalPureEnum_(input.status, 'status', PORTAL_WORKORDER_STATUSES),
    assigneeUserId: input.assigneeUserId ? portalPureId_(input.assigneeUserId, 'assigneeUserId') : '',
    dueDate: portalPureOptionalIsoDate_(input.dueDate, 'dueDate'),
    instructions: portalPureString_(String(input.instructions || ''), 'instructions', 1, 3000, null),
    visibility: portalPureVisibility_(input.visibility),
    revision: portalPureRevision_(input.revision)
  };
}

function portalPureWorkOrderTransitionAllowed_(from, to) {
  if (!from) return to === 'received' || to === 'planned';
  var allowed = {
    received: ['planned', 'cancelled'],
    planned: ['working', 'blocked', 'cancelled'],
    working: ['blocked', 'completed', 'cancelled'],
    blocked: ['planned', 'working', 'cancelled'],
    completed: [],
    cancelled: []
  };
  return from === to || portalPureHas_(allowed[from] || [], to);
}

function portalPureNoticeInput_(input) {
  input = input || {};
  var publishDate = portalPureOptionalIsoDate_(input.publishDate, 'publishDate');
  var expiresDate = portalPureOptionalIsoDate_(input.expiresDate, 'expiresDate');
  if (publishDate && expiresDate && publishDate > expiresDate) {
    throw portalPureError_('invalid_date_range', 'notice date range is invalid');
  }
  return {
    noticeId: input.noticeId ? portalPureId_(input.noticeId, 'noticeId') : '',
    title: portalPureString_(String(input.title || ''), 'title', 2, 160, null),
    content: portalPureString_(String(input.content || ''), 'content', 1, 5000, null),
    visibility: portalPureVisibility_(input.visibility),
    state: portalPureEnum_(input.state, 'state', PORTAL_NOTICE_STATES),
    publishDate: publishDate,
    expiresDate: expiresDate,
    revision: portalPureRevision_(input.revision)
  };
}

function portalPureNoticeTransitionAllowed_(from, to) {
  if (!from) return to === 'draft' || to === 'published';
  var allowed = { draft: ['published', 'archived'], published: ['archived'], archived: [] };
  return from === to || portalPureHas_(allowed[from] || [], to);
}

function portalPureCostInput_(input) {
  input = input || {};
  var amount = Number(input.amountKrw);
  if (!isFinite(amount) || Math.floor(amount) !== amount || amount < 1 || amount > 1000000000) {
    throw portalPureError_('invalid_amountKrw', 'amountKrw is invalid');
  }
  return {
    costId: input.costId ? portalPureId_(input.costId, 'costId') : '',
    workOrderId: input.workOrderId ? portalPureId_(input.workOrderId, 'workOrderId') : '',
    category: portalPureString_(String(input.category || ''), 'category', 1, 48, null),
    description: portalPureString_(String(input.description || ''), 'description', 1, 1000, null),
    amountKrw: amount,
    taxMode: portalPureEnum_(input.taxMode, 'taxMode', PORTAL_COST_TAX_MODES),
    status: portalPureEnum_(input.status, 'status', ['draft', 'submitted']),
    revision: portalPureRevision_(input.revision)
  };
}

function portalPureCostTransitionAllowed_(from, to) {
  var allowed = { submitted: ['approved', 'cancelled'], approved: ['paid', 'cancelled'] };
  return portalPureHas_(allowed[from] || [], to);
}

function portalPureUserInput_(input) {
  input = input || {};
  return {
    userId: input.userId ? portalPureId_(input.userId, 'userId') : '',
    email: portalPureEmail_(input.email),
    name: portalPureString_(String(input.name || ''), 'name', 1, 80, null),
    role: portalPureRole_(input.role),
    unit: portalPureOptionalString_(input.unit, 'unit', 40),
    active: portalPureBool_(input.active, 'active'),
    loginCode: portalPureLoginCode_(input.loginCode, false)
  };
}

function portalPureOfficeInput_(input) {
  input = input || {};
  return {
    officeId: portalPureId_(input.officeId, 'officeId'),
    slug: portalPureSlug_(input.slug),
    complexName: portalPureString_(String(input.complexName || ''), 'complexName', 1, 120, null),
    enabled: input.enabled === undefined ? true : portalPureBool_(input.enabled, 'enabled')
  };
}

function portalPureIsStaff_(role) {
  return role === 'manager_chief' || role === 'facility_manager';
}

function portalPureCanSeeRecord_(record, viewer) {
  if (!record || !viewer) return false;
  if (record.officeId !== viewer.officeId) return false;
  if (portalPureIsStaff_(viewer.role)) return true;
  if (viewer.role === 'resident_rep') {
    return record.visibility === 'board' || record.visibility === 'public';
  }
  if (viewer.role === 'resident') {
    return record.visibility === 'public';
  }
  return false;
}

function portalPureProjectRecord_(record, viewer, kind) {
  if (!portalPureCanSeeRecord_(record, viewer)) return null;
  var result = {
    category: record.category,
    visibility: record.visibility,
    updatedAt: record.updatedAt,
    revision: Number(record.revision || 0)
  };
  if (kind === 'status') {
    result.statusId = record.statusId;
    result.location = record.location;
    result.summary = record.summary;
    result.state = record.state;
  } else {
    result.logId = record.logId;
    result.workDate = record.workDate;
    result.title = record.title;
    result.content = record.content;
    result.createdAt = record.createdAt;
  }
  return result;
}

function portalPureSafeUser_(user, includeEmail) {
  var result = {
    id: user.userId,
    name: user.displayName,
    role: user.role,
    active: user.enabled === true || String(user.enabled).toLowerCase() === 'true',
    permissions: Array.isArray(user.permissions) ? user.permissions.slice() : [],
    loginCodeConfigured: Boolean(user.loginCodeHash && user.loginCodeSalt)
  };
  result.email = includeEmail ? user.email : '';
  if (user.unit) result.unit = user.unit;
  return result;
}

function portalPureSafeAudit_(row) {
  return {
    auditId: row.auditId,
    officeId: row.officeId,
    actorUserId: row.actorUserId,
    role: row.role,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    result: row.result,
    at: row.at,
    createdAt: row.at,
    summary: row.result
  };
}

'use strict';

var OI_SESSION_MS = 8 * 60 * 60 * 1000;
var OI_ISSUE_TYPES = ['누수', '배수', '급수', '난방', '방수', '공용시설', '기타'];
var OI_PIPE_TYPES = ['미확정', '오수', '우수', '잡배수', '난방', '급수'];
var OI_TRANSITIONS = {
  pending_review: ['needs_info', 'accepted', 'on_hold', 'cancelled'],
  needs_info: ['pending_review', 'on_hold', 'cancelled'],
  accepted: ['visit_scheduled', 'on_hold'],
  visit_scheduled: ['in_progress', 'on_hold'],
  in_progress: ['completed', 'on_hold'],
  completed: ['billed'],
  billed: ['paid'],
  paid: [],
  on_hold: ['pending_review', 'accepted', 'visit_scheduled', 'in_progress', 'cancelled'],
  cancelled: []
};

function oiText_(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
function oiDigits_(value) { return String(value == null ? '' : value).replace(/\D/g, ''); }
function oiNormalizePhone_(value) {
  var n = oiDigits_(value);
  if (n.length === 11) return n.slice(0, 3) + '-' + n.slice(3, 7) + '-' + n.slice(7);
  if (n.length === 10) return n.slice(0, 3) + '-' + n.slice(3, 6) + '-' + n.slice(6);
  return '';
}
function oiExpectedUploadIds_(value) {
  if (!Array.isArray(value) || value.length > 5) return null;
  var ids = [], seen = {};
  for (var i = 0; i < value.length; i++) {
    var id = value[i];
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) || seen[id]) return null;
    seen[id] = true; ids.push(id);
  }
  return ids;
}
function oiValidateCreate_(p) {
  p = p && typeof p === 'object' ? p : {};
  var value = {
    idempotencyKey: oiText_(p.idempotencyKey, 80),
    unit: oiText_(p.unit, 80),
    location: oiText_(p.location, 120),
    issueType: oiText_(p.issueType, 20),
    pipeType: oiText_(p.pipeType || '미확정', 20),
    urgency: p.urgency === 'urgent' ? 'urgent' : 'normal',
    description: oiText_(p.description, 1200),
    officeContact: {
      name: oiText_(p.officeContact && p.officeContact.name, 60),
      phone: oiNormalizePhone_(p.officeContact && p.officeContact.phone)
    },
    residentContact: p.residentContact ? {
      name: oiText_(p.residentContact.name, 60),
      phone: oiNormalizePhone_(p.residentContact.phone)
    } : null,
    preferredVisitDate: oiText_(p.preferredVisitDate, 10),
    privacyConsent: p.privacyConsent === true
  };
  if (Object.prototype.hasOwnProperty.call(p, 'expectedUploadIds')) {
    value.expectedUploadIds = oiExpectedUploadIds_(p.expectedUploadIds);
    if (value.expectedUploadIds === null) return { ok: false, error: 'invalid-input', field: 'expectedUploadIds' };
  }
  var required = [['idempotencyKey', value.idempotencyKey], ['unit', value.unit], ['location', value.location], ['description', value.description]];
  for (var i = 0; i < required.length; i++) if (!required[i][1]) return { ok: false, error: 'invalid-input', field: required[i][0] };
  if (OI_ISSUE_TYPES.indexOf(value.issueType) < 0) return { ok: false, error: 'invalid-input', field: 'issueType' };
  if (OI_PIPE_TYPES.indexOf(value.pipeType) < 0) return { ok: false, error: 'invalid-input', field: 'pipeType' };
  if (!value.officeContact.name) return { ok: false, error: 'invalid-input', field: 'officeContact.name' };
  if (!value.officeContact.phone) return { ok: false, error: 'invalid-input', field: 'officeContact.phone' };
  if (!value.privacyConsent) return { ok: false, error: 'consent-required', field: 'privacyConsent' };
  return { ok: true, value: value };
}
function oiCanTransition_(from, to, actor) {
  if (actor === 'office') return (from === 'pending_review' || from === 'needs_info') && (to === 'pending_review' || to === 'cancelled');
  return !!(OI_TRANSITIONS[from] && OI_TRANSITIONS[from].indexOf(to) >= 0);
}
function oiReceiptNo_(yyyymmdd, sequence) { return 'MM-' + yyyymmdd + '-' + ('0000' + sequence).slice(-4); }
function oiSessionPayload_(officeId, sessionVersion, issuedAt) {
  return { officeId: officeId, sessionVersion: sessionVersion, issuedAt: issuedAt, expiresAt: issuedAt + OI_SESSION_MS };
}
function oiRedactPhone_(value) {
  var n = oiNormalizePhone_(value); return n ? n.slice(0, 4) + '****' + n.slice(-5) : '';
}

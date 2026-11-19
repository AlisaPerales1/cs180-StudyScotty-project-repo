/**
 * In-memory UI fixtures only. Direct user targets are provisional: the backend
 * AbuseReport currently targets sessions. This is not an agreed API/schema.
 * Authentication and persistence will replace the fixed demo reporter/store.
 */
export const REPORTER_ID = 42;
export const REPORT_USERS = [
  { id: 42, username: 'scotty' },
  { id: 43, username: 'river' },
  { id: 44, username: 'alex' },
];
export const REPORT_STATUSES = ['pending', 'reviewed', 'dismissed'];

/** @typedef {{ id: number, title: string, host_id: number, status: string, cancelled_at?: string, cancelled_by?: string, cancellation_reason?: string }} DemoSession */
/** @type {DemoSession[]} */
let sessions = [
  { id: 101, title: 'CS180 project study group', host_id: 43, status: 'upcoming' },
  { id: 102, title: 'Library math circle', host_id: 44, status: 'active' },
];

/** @typedef {{ id: number, reporter_id: number, target_id: number, target_type?: 'user' | 'session', reason: string, details: string, status: string, created_at: string, reviewed_at?: string, reviewed_by?: string, review_note?: string }} DemoReport */
/** @type {DemoReport[]} */
let reports = [
  { id: 4, reporter_id: 42, target_type: 'session', target_id: 101, reason: 'Misleading session', details: 'The advertised study session was being used for unrelated promotions.', status: 'pending', created_at: '2026-11-18T17:00:00Z' },
  { id: 3, reporter_id: 42, target_id: 43, reason: 'Harassment', details: 'Repeated insulting messages after I asked them to stop.', status: 'pending', created_at: '2026-11-18T16:00:00Z' },
  { id: 2, reporter_id: 44, target_id: 43, reason: 'Disruptive behavior', details: 'Repeatedly interrupted our library study group.', status: 'reviewed', created_at: '2026-11-17T18:00:00Z' },
  { id: 1, reporter_id: 43, target_id: 44, reason: 'Spam', details: 'Posted the same invitation several times.', status: 'dismissed', created_at: '2026-11-16T19:00:00Z' },
];
const listeners = new Set();

/** @param {() => void} listener */
export function subscribeReports(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getReports() {
  return reports;
}

/** @param {{ target_id: number, reason: string, details: string, target_type?: 'user' | 'session' }} input */
export function submitReport({ target_id, reason, details, target_type = 'user' }) {
  if (target_type === 'user' && (target_id === REPORTER_ID || !REPORT_USERS.some((user) => user.id === target_id))) {
    throw new Error('Choose another user to report.');
  }
  if (target_type === 'session' && !sessions.some((session) => session.id === target_id && session.status !== 'cancelled')) {
    throw new Error('Choose an available session to report.');
  }
  if (!reason.trim()) throw new Error('Enter a reason before submitting.');
  if (reason.trim().length > 100) throw new Error('Use 100 characters or fewer for the reason.');
  /** @type {DemoReport} */
  const report = {
    id: Math.max(0, ...reports.map((entry) => entry.id)) + 1,
    reporter_id: REPORTER_ID,
    target_id,
    target_type,
    reason: reason.trim(),
    details: details.trim(),
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  reports = [report, ...reports];
  listeners.forEach((listener) => listener());
  return report;
}

export function getReportSessions() {
  return sessions;
}

/** @param {DemoReport} report */
export function reportTarget(report) {
  return report.target_type === 'session'
    ? sessions.find((session) => session.id === report.target_id)?.title || 'Unknown session'
    : `@${reportUsername(report.target_id)}`;
}

/** Demo admin review only; cancelling preserves the session and its reports.
 * @param {number} reportId @param {'dismiss' | 'cancel_session'} action @param {string} note
 */
export function reviewSessionReport(reportId, action, note) {
  const report = reports.find((entry) => entry.id === reportId);
  if (!report || report.target_type !== 'session' || report.status !== 'pending') {
    throw new Error('Select a pending session report.');
  }
  const session = sessions.find((entry) => entry.id === report.target_id);
  if (!session) throw new Error('Session not found.');
  if (!note.trim()) throw new Error('Enter a review reason.');
  if (action === 'cancel_session' && session.status === 'cancelled') throw new Error('This session is already cancelled.');
  const reviewed_at = new Date().toISOString();
  if (action === 'cancel_session') {
    sessions = sessions.map((entry) => entry.id === session.id ? {
      ...entry, status: 'cancelled', cancelled_at: reviewed_at, cancelled_by: 'Demo admin', cancellation_reason: note.trim(),
    } : entry);
  }
  reports = reports.map((entry) => entry.id === reportId ? {
    ...entry, status: action === 'dismiss' ? 'dismissed' : 'reviewed',
    reviewed_at, reviewed_by: 'Demo admin', review_note: note.trim(),
  } : entry);
  listeners.forEach((listener) => listener());
}

/** @param {number} id */
export function reportUsername(id) {
  return REPORT_USERS.find((user) => user.id === id)?.username || `user-${id}`;
}

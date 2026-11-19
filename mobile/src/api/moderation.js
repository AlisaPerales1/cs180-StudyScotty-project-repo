/**
 * Demo-only account moderation. Data resets when the app reloads.
 * Replace these internals once authentication and admin lookup are available.
 * Action payloads/results follow docs/api-contract.md; the list is a UI fixture,
 * not an agreed backend lookup contract.
 */

/** @typedef {'active' | 'suspended' | 'banned'} AccountState */
/** @typedef {'suspend' | 'ban' | 'restore'} AccountAction */
/** @typedef {{ user_id: number, username: string, email: string, state: AccountState, ends_at: string | null }} DemoAccount */

/** @type {DemoAccount[]} */
const accounts = [
  { user_id: 42, username: 'scotty', email: 'scotty@ucr.edu', state: 'active', ends_at: null },
  { user_id: 43, username: 'river', email: 'river@ucr.edu', state: 'suspended', ends_at: new Date(Date.now() + 86400000).toISOString() },
  { user_id: 44, username: 'alex', email: 'alex@ucr.edu', state: 'banned', ends_at: null },
];

function expireSuspensions() {
  for (const account of accounts) {
    if (account.state === 'suspended' && Date.parse(account.ends_at) <= Date.now()) {
      account.state = 'active';
      account.ends_at = null;
    }
  }
}

export async function getModerationAccounts() {
  expireSuspensions();
  return accounts.map((account) => ({ ...account }));
}

/** @param {number} userId @param {AccountAction} action @param {{ reason?: string, ends_at?: string }} body */
export async function moderateAccount(userId, action, body) {
  expireSuspensions();
  const account = accounts.find((entry) => entry.user_id === userId);
  if (!account) throw new Error('Account not found.');
  if (action !== 'restore' && !body.reason?.trim()) throw new Error('Enter a reason.');
  if (action === 'suspend') {
    if (account.state === 'banned') throw new Error('Restore this account before suspending it.');
    if (!body.ends_at || !(Date.parse(body.ends_at) > Date.now())) {
      throw new Error('Choose a future suspension expiry.');
    }
  }
  account.state = action === 'restore' ? 'active' : action === 'ban' ? 'banned' : 'suspended';
  account.ends_at = action === 'suspend' ? body.ends_at : null;
  return { user_id: account.user_id, state: account.state, ends_at: account.ends_at };
}

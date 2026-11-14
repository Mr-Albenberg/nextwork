// Account type is assigned by the database at signup. Never authorize from user_metadata.
function isOrganizationAccount(user = typeof Account !== 'undefined' ? Account.user : null) {
  return user?.app_metadata?.nextwork_account_type === 'organization';
}
function accountHome() { return isOrganizationAccount() ? 'organization' : 'overview'; }
function accountRouteAllowed(page) {
  if (typeof Account === 'undefined' || !Account.user) return true;
  if (isOrganizationAccount()) return ['home','pricing','organization','organization-login','organization-signup','messages','settings','login','forgot','password'].includes(page);
  return true;
}
function organizationAccountRequired() {
  return '<section class="panel wide-panel"><h2>A separate organization account is required.</h2><p>Your personal account is for finding work and applying. It cannot become an organization account. Sign out and create an organization account with a different email to hire people.</p><div class="dialog-actions"><a class="primary" href="#overview">Back to your workspace</a><button class="outline" data-auth-action="organization-signout">Sign out for organization access</button></div></section>';
}

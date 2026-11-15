// Incoming-message notices never open a composer or take focus from the current page.
const MessageWidget = {
  notice: null,
  announcement: "",
  timer: null,
  owner: null,
};
function resetMessageWidget() {
  clearTimeout(MessageWidget.timer);
  document.querySelector("#message-widget")?.remove();
  Object.assign(MessageWidget, {
    notice: null,
    announcement: "",
    timer: null,
    owner: null,
  });
}
function messageWidgetVisible() {
  return (
    Messaging.ready &&
    Messaging.owner === messagingActor() &&
    Boolean(Messaging.owner) &&
    location.hash !== "#messages"
  );
}
function notifyMessageWidget(previous, rows) {
  if (!messageWidgetVisible()) return;
  const counts = new Map(
      previous.map((row) => [row.id, Number(row.unread || 0)]),
    ),
    incoming = rows.filter(
      (row) =>
        !row.archived && Number(row.unread || 0) > (counts.get(row.id) || 0),
    );
  if (!incoming.length) return;
  MessageWidget.notice = incoming[0].other_id;
  MessageWidget.owner = Messaging.owner;
  MessageWidget.announcement = "New message from " + incoming[0].contact.name;
  clearTimeout(MessageWidget.timer);
  MessageWidget.timer = setTimeout(dismissMiniChatNotice, 9000);
}
async function refreshMessageWidgetMessages() {} // The full inbox loads messages when opened.
function dismissMiniChatNotice() {
  clearTimeout(MessageWidget.timer);
  MessageWidget.notice = null;
  renderMessageWidget();
}
function openMessageNotification() {
  const id = MessageWidget.notice;
  dismissMiniChatNotice();
  if (id) openConversation(id);
}
function renderMessageWidget() {
  let root = document.querySelector("#message-widget");
  const row = MessageWidget.notice
      ? conversationFor(MessageWidget.notice)
      : null,
    show =
      messageWidgetVisible() &&
      row &&
      Number(row.unread) > 0 &&
      MessageWidget.owner === Messaging.owner;
  if (!show) {
    if (root) root.hidden = true;
    return;
  }
  if (!root) {
    root = document.createElement("div");
    root.id = "message-widget";
    root.className = "message-notification";
    document.body.append(root);
  }
  root.hidden = false;
  const p = person(MessageWidget.notice);
  root.innerHTML = `<div class="message-notification-copy" role="status" aria-live="polite">${icon("message", 20)}<span><b>New message</b><small>${esc(p?.name || "A member")} sent you a message</small></span></div><button class="text-control" onclick="openMessageNotification()">View</button><button class="icon-button" aria-label="Dismiss message notification" onclick="dismissMiniChatNotice()">${icon("close", 16)}</button>`;
}
window.addEventListener("hashchange", () => {
  if (location.hash === "#messages") dismissMiniChatNotice();
  else renderMessageWidget();
});

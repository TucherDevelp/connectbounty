// ── Chat Detail Page ──────────────────────────────
let _chatPollTimer = null;

async function renderChatDetail({ id }) {
  const { user } = Store.getState();
  if (!user) {
    return `<div class="container section"><div class="empty-state">
      <div class="empty-state-icon">🔐</div>
      <div class="empty-state-title">Bitte einloggen</div>
      <button class="btn btn-primary mt-4" onclick="navigate('/login')">Jetzt anmelden</button>
    </div></div>`;
  }

  // Nachrichten laden
  const messages = await UserAPI.getConversationMessages(id);
  const msgList = Array.isArray(messages) ? messages : [];

  // Konversations-Info aus erster System-Nachricht oder Header holen
  const convs = await UserAPI.getConversations();
  const convArr = Array.isArray(convs) ? convs : [];
  const conv = convArr.find(c => c.id === id);

  const partnerName = conv ? conv.partnerUsername : 'Gesprächspartner';
  const listingTitle = conv ? `${conv.listing_company} – ${conv.listing_title}` : 'Inserat';
  const bonusStr = conv ? `${conv.listing_bonus?.toLocaleString('de-DE') || '–'} ${conv.listing_currency || 'EUR'}` : '';

  const msgsHtml = msgList.map(m => {
    const isOwn = m.sender_id === user.id;
    const flaggedClass = m.ai_flagged ? ' chat-msg-flagged' : '';
    const flaggedNote = m.ai_flagged && m.ai_review_note
      ? `<div class="text-xs" style="color:var(--c-warning);margin-top:4px;">⚠️ ${m.ai_review_note}</div>`
      : '';
    const timeStr = new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="chat-msg ${isOwn ? 'chat-msg-out' : 'chat-msg-in'}${flaggedClass}">
        ${!isOwn ? `<div class="text-xs" style="font-weight:600;margin-bottom:2px;color:var(--c-primary);">${escapeHtml(m.sender_username)}</div>` : ''}
        <div>${escapeHtml(m.message)}</div>
        ${flaggedNote}
        <div class="text-xs text-muted" style="text-align:right;margin-top:4px;">${timeStr}</div>
      </div>`;
  }).join('');

  // Polling starten
  setTimeout(() => startChatPolling(id, user.id), 300);

  return `
    <div class="container" style="padding-top:var(--sp-4);padding-bottom:var(--sp-16);max-width:680px;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--sp-4);">
        <button class="btn btn-ghost btn-sm" onclick="stopChatPolling();navigate('/chat')" style="padding:4px 8px;">←</button>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:1.05rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${listingTitle}</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="text-sm text-muted">${partnerName}</span>
            ${bonusStr ? `<span class="badge badge-primary" style="font-size:0.65rem;">${bonusStr}</span>` : ''}
          </div>
        </div>
        <span class="chat-ai-badge">KI-überwacht</span>
      </div>

      <!-- Messages -->
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="chat-messages" id="chat-messages" style="height:calc(100dvh - 260px);min-height:300px;overflow-y:auto;padding:var(--sp-4);">
          ${msgsHtml}
        </div>
        <div class="chat-input-row" style="border-top:1px solid var(--c-border);">
          <input class="chat-input" id="chat-input" type="text" placeholder="Nachricht schreiben..." maxlength="2000"
            onkeydown="if(event.key==='Enter')sendConvMsg('${id}')">
          <button class="btn btn-primary btn-sm" onclick="sendConvMsg('${id}')">Senden</button>
        </div>
      </div>
    </div>`;
}

async function sendConvMsg(conversationId) {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  const messagesEl = document.getElementById('chat-messages');
  const { user } = Store.getState();

  // Optimistic UI
  const timeStr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const ownMsg = document.createElement('div');
  ownMsg.className = 'chat-msg chat-msg-out';
  ownMsg.innerHTML = `<div>${escapeHtml(msg)}</div><div class="text-xs text-muted" style="text-align:right;margin-top:4px;">${timeStr}</div>`;
  messagesEl.appendChild(ownMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const result = await UserAPI.sendConversationMessage(conversationId, msg);

    if (result.flagged && result.aiWarning) {
      const warningEl = document.createElement('div');
      warningEl.className = 'chat-msg chat-msg-system';
      warningEl.innerHTML = `<div>⚠️ ${escapeHtml(result.aiWarning)}</div>`;
      messagesEl.appendChild(warningEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      Toast.warning('Nachricht markiert', 'Möglicher Richtlinienverstoß erkannt.');
    }
  } catch (e) {
    Toast.error('Fehler', 'Nachricht konnte nicht gesendet werden.');
  }
}

// ── Polling für neue Nachrichten ──────────────────
function startChatPolling(conversationId, userId) {
  stopChatPolling();
  let lastCount = document.getElementById('chat-messages')?.children?.length || 0;

  _chatPollTimer = setInterval(async () => {
    // Nur pollen wenn der Chat sichtbar ist
    if (!document.getElementById('chat-messages')) {
      stopChatPolling();
      return;
    }

    try {
      const messages = await UserAPI.getConversationMessages(conversationId);
      const msgList = Array.isArray(messages) ? messages : [];

      if (msgList.length > lastCount) {
        const messagesEl = document.getElementById('chat-messages');
        if (!messagesEl) return;

        // Nur neue Nachrichten hinzufügen
        const newMsgs = msgList.slice(lastCount);
        for (const m of newMsgs) {
          // Eigene Nachrichten überspringen (schon via Optimistic UI da)
          if (m.sender_id === userId) continue;

          const timeStr = new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const flaggedNote = m.ai_flagged && m.ai_review_note
            ? `<div class="text-xs" style="color:var(--c-warning);margin-top:4px;">⚠️ ${m.ai_review_note}</div>`
            : '';

          const el = document.createElement('div');
          el.className = `chat-msg chat-msg-in${m.ai_flagged ? ' chat-msg-flagged' : ''}`;
          el.innerHTML = `
            <div class="text-xs" style="font-weight:600;margin-bottom:2px;color:var(--c-primary);">${escapeHtml(m.sender_username)}</div>
            <div>${escapeHtml(m.message)}</div>
            ${flaggedNote}
            <div class="text-xs text-muted" style="text-align:right;margin-top:4px;">${timeStr}</div>`;
          messagesEl.appendChild(el);
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
        lastCount = msgList.length;
      }
    } catch (e) {
      // Silent fail on poll errors
    }
  }, 5000);
}

function stopChatPolling() {
  if (_chatPollTimer) {
    clearInterval(_chatPollTimer);
    _chatPollTimer = null;
  }
}

const GUEST_KEY = 'tiny-messenger-guest-v1';

export class ApiError extends Error {
  constructor(message, code = 'ERROR', status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export class Api {
  constructor() {
    this.accountId = localStorage.getItem(GUEST_KEY) || null;
    this.state = null;
  }

  get hasGuest() {
    return Boolean(this.accountId);
  }

  async request(path, { method = 'GET', body, keepalive = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.accountId) headers['X-Guest-Id'] = this.accountId;

    let response;
    try {
      response = await fetch(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        keepalive,
      });
    } catch (error) {
      throw new ApiError('风太大，信没有送出去。检查一下网络好吗？', 'NETWORK', 0);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new ApiError(
        payload?.message || '小星球打了个喷嚏，再试一次吧。',
        payload?.error || 'HTTP_ERROR',
        response.status,
      );
    }
    return payload;
  }

  async world() {
    return this.request('/api/world');
  }

  async login(name) {
    const body = { name };
    if (this.accountId) body.account_id = this.accountId;
    const payload = await this.request('/api/login', { method: 'POST', body });
    this.accountId = payload.account_id;
    localStorage.setItem(GUEST_KEY, payload.account_id);
    this.state = payload.state;
    return payload;
  }

  async fetchState() {
    this.state = await this.request('/api/state');
    return this.state;
  }

  async heartbeat({ dir, heading, emote = null }) {
    return this.request('/api/heartbeat', {
      method: 'POST',
      body: { dir, heading, emote },
    });
  }

  async acceptLetter({ dir, heading }) {
    const payload = await this.request('/api/letter/accept', {
      method: 'POST',
      body: { dir, heading },
    });
    this.state = payload.state;
    return payload;
  }

  async deliver({ npcId, dir, heading }) {
    const payload = await this.request('/api/letter/deliver', {
      method: 'POST',
      body: { npc_id: npcId, dir, heading },
    });
    this.state = payload.state;
    return payload;
  }

  async talk({ npcId, dir, heading }) {
    const payload = await this.request('/api/talk', {
      method: 'POST',
      body: { npc_id: npcId, dir, heading },
    });
    this.state = payload.state;
    return payload;
  }

  async acceptTask(taskId) {
    const payload = await this.request(`/api/tasks/${encodeURIComponent(taskId)}/accept`, {
      method: 'POST',
    });
    this.state = payload.state;
    return payload;
  }

  async claimTask(taskId) {
    const payload = await this.request(`/api/tasks/${encodeURIComponent(taskId)}/claim`, {
      method: 'POST',
    });
    this.state = payload.state;
    return payload;
  }

  async claimMilestone(index) {
    const payload = await this.request(`/api/collection/${index}/claim`, { method: 'POST' });
    this.state = payload.state;
    return payload;
  }

  async purchase(offerId) {
    const payload = await this.request('/api/shop/purchase', {
      method: 'POST',
      body: { offer_id: offerId },
    });
    this.state = payload.state;
    return payload;
  }

  async equip(skinId) {
    const payload = await this.request('/api/avatar/equip', {
      method: 'POST',
      body: { skin_id: skinId },
    });
    this.state = payload.state;
    return payload;
  }

  async markAnnouncementRead(id) {
    return this.request(`/api/announcements/${encodeURIComponent(id)}/read`, { method: 'POST' });
  }

  async logout() {
    try {
      await this.request('/api/logout', { method: 'POST', keepalive: true });
    } catch {
      // Leaving quietly is fine.
    }
  }
}

import { HAT_EMOJI, HAT_LABEL } from './character.js';

const NPC_EMOJI = {
  poppy: '💌',
  ada: '🕯️',
  milo: '🥖',
  nia: '🐚',
  tom: '🏮',
  ruby: '🚂',
  pip: '🎨',
};

const STAMP_NAMES = {
  ada: '灯塔邮票',
  milo: '麦香邮票',
  nia: '贝壳邮票',
  tom: '山岚邮票',
  ruby: '汽笛邮票',
  pip: '森林邮票',
};

const TASK_STATUS = {
  available: { label: '可接取', tag: '' },
  active: { label: '进行中', tag: '' },
  completed: { label: '待领奖', tag: 'ready' },
  claimed: { label: '已完成', tag: 'claimed' },
  locked: { label: '未解锁', tag: 'claimed' },
  expired: { label: '已过期', tag: 'claimed' },
};

const PANEL_TITLES = {
  tasks: '邮局任务板',
  collection: '居民邮票册',
  shop: '风铃帽子铺',
  leaderboard: '本周邮差榜',
  news: '星球公告',
};

const KIND_LABELS = {
  news: '邮局公告',
  event: '活动',
  maintenance: '维护',
  promotion: '推广',
  system: '系统',
};

const ACHIEVEMENT_ICON = {
  first_delivery: '✉️',
  courier_10: '🚲',
  meet_all: '🫖',
  stamp_master: '📮',
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));

function timeLeft(ms) {
  if (!ms || ms <= 0) return '';
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes} 分钟后`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} 小时后`;
}

export class UI {
  constructor({ api, world, audio, handlers }) {
    this.api = api;
    this.world = world;
    this.audio = audio;
    this.handlers = handlers || {};
    this.state = null;
    this.activePanel = null;
    this.dialogOpen = false;
    this.busy = false;
    this.trackTarget = null;
    this.trackNpcId = null;
    this.currentPrompt = null;
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    this.elements = {
      titleScreen: document.getElementById('title-screen'),
      titleCard: document.querySelector('.title-card'),
      startButton: document.getElementById('start-button'),
      titleError: document.getElementById('title-error'),
      nameInput: document.getElementById('name-input'),
      boot: document.getElementById('boot'),
      hud: document.getElementById('hud'),
      avatarHat: document.getElementById('avatar-hat'),
      playerName: document.getElementById('player-name'),
      playerLevel: document.getElementById('player-level'),
      playerDeliveries: document.getElementById('player-deliveries'),
      playerCoins: document.getElementById('player-coins'),
      onlineCount: document.getElementById('online-count'),
      newsBadge: document.getElementById('news-badge'),
      tracker: document.getElementById('letter-tracker'),
      trackerTarget: document.getElementById('tracker-target'),
      trackerPlace: document.getElementById('tracker-place'),
      compassArrow: document.getElementById('compass-arrow'),
      prompt: document.getElementById('interact-prompt'),
      promptText: document.getElementById('prompt-text'),
      toasts: document.getElementById('toasts'),
      dialog: document.getElementById('dialog'),
      dialogAvatar: document.getElementById('dialog-avatar'),
      dialogName: document.getElementById('dialog-name'),
      dialogTitle: document.getElementById('dialog-title'),
      dialogLine: document.getElementById('dialog-line'),
      dialogActions: document.getElementById('dialog-actions'),
      dialogClose: document.getElementById('dialog-close'),
      panel: document.getElementById('panel'),
      panelTitle: document.getElementById('panel-title'),
      panelBody: document.getElementById('panel-body'),
      panelClose: document.getElementById('panel-close'),
      panelBackdrop: document.getElementById('panel-backdrop'),
      panelTabs: document.getElementById('panel-tabs'),
      soundToggle: document.getElementById('sound-toggle'),
      joystick: document.getElementById('joystick'),
      joystickKnob: document.querySelector('.joystick-knob'),
      jumpButton: document.getElementById('jump-btn'),
      interactButton: document.getElementById('interact-btn'),
      emoteBar: document.getElementById('emote-bar'),
    };

    const savedName = localStorage.getItem('tiny-messenger-name');
    if (savedName) this.elements.nameInput.value = savedName;

    this.bindStaticEvents();
    this.updateSoundIcon();
    if (this.isTouch) {
      this.elements.joystick.classList.remove('hidden');
      this.elements.jumpButton.classList.remove('hidden');
      this.elements.interactButton.classList.remove('hidden');
    }
  }

  // -------------------------------------------------------------------------
  // Boot / title
  // -------------------------------------------------------------------------

  finishBoot() {
    this.elements.boot.classList.add('gone');
    this.elements.startButton.disabled = false;
    this.elements.startButton.textContent = '背起邮包，出发';
  }

  setStarting() {
    this.elements.startButton.disabled = true;
    this.elements.startButton.textContent = '正在把信装进邮包…';
    this.elements.titleError.textContent = '';
  }

  showTitleError(message) {
    this.elements.titleError.textContent = message;
    this.elements.startButton.disabled = false;
    this.elements.startButton.textContent = '背起邮包，出发';
  }

  enterGame(state) {
    this.elements.titleScreen.classList.add('gone');
    this.elements.hud.classList.remove('hidden');
    this.updateState(state);
    if (this.isTouch) {
      this.elements.emoteBar.classList.add('hidden');
    }
    const hasUnread = state.announcements.some((announcement) => !announcement.read);
    if (hasUnread) {
      window.setTimeout(() => this.openPanel('news'), 900);
    }
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  updateState(state) {
    this.state = state;
    const player = state.player;
    this.elements.playerName.textContent = player.name;
    this.elements.playerLevel.textContent = `Lv.${player.level}`;
    this.elements.playerDeliveries.textContent = player.deliveries;
    this.elements.playerCoins.textContent = player.coins;
    this.elements.avatarHat.textContent = HAT_EMOJI[player.hat] || '🧢';
    this.elements.onlineCount.textContent = state.online || 1;
    this.updateNewsBadge();
    this.updateTracker();
    this.handlers.onState?.(state);
    if (this.activePanel) this.renderPanel();
  }

  setOnline(count) {
    if (this.state) this.state.online = count;
    this.elements.onlineCount.textContent = count;
  }

  updateNewsBadge() {
    const unread = this.state?.announcements?.some((announcement) => !announcement.read);
    this.elements.newsBadge.classList.toggle('hidden', !unread);
  }

  updateTracker() {
    const letter = this.state?.letter;
    if (!letter) {
      this.elements.tracker.classList.add('hidden');
      this.trackTarget = null;
      this.trackNpcId = null;
      return;
    }
    const npc = this.world.npcs.find((item) => item.id === letter.npc_id);
    this.trackTarget = npc ? npc.dir : null;
    this.trackNpcId = letter.npc_id;
    this.elements.trackerTarget.textContent = `写给${letter.npc_name}的信`;
    this.elements.trackerPlace.textContent = letter.place_name;
    this.elements.tracker.classList.remove('hidden');
  }

  updateCompass(angle) {
    if (!this.trackTarget) return;
    const degrees = (angle * 180) / Math.PI;
    this.elements.compassArrow.style.transform = `rotate(${degrees - 90}deg)`;
  }

  // -------------------------------------------------------------------------
  // Interaction prompt & dialog
  // -------------------------------------------------------------------------

  setPrompt(text) {
    if (text === this.currentPrompt) return;
    this.currentPrompt = text;
    if (!text) {
      this.elements.prompt.classList.add('hidden');
      return;
    }
    this.elements.promptText.textContent = text;
    this.elements.prompt.classList.remove('hidden');
  }

  isBlocking() {
    return this.dialogOpen || Boolean(this.activePanel);
  }

  notifyBlocking() {
    this.handlers.onBlockingChange?.(this.isBlocking());
  }

  showDialog({ npcId, name, title, line, actions = [] }) {
    this.closePanel(false);
    this.elements.dialogAvatar.textContent = NPC_EMOJI[npcId] || '🧑‍🌾';
    this.elements.dialogName.textContent = name;
    this.elements.dialogTitle.textContent = title;
    this.elements.dialogLine.textContent = line;
    this.elements.dialogActions.innerHTML = '';
    for (const action of actions) {
      const button = document.createElement('button');
      button.className = `btn ${action.primary ? 'primary' : 'ghost'} small`;
      button.textContent = action.label;
      button.addEventListener('click', async () => {
        if (this.busy) return;
        await action.onClick?.();
      });
      this.elements.dialogActions.appendChild(button);
    }
    this.elements.dialog.classList.remove('hidden');
    this.dialogOpen = true;
    this.notifyBlocking();
    this.setPrompt(null);
  }

  updateDialogLine(line) {
    this.elements.dialogLine.textContent = line;
  }

  closeDialog() {
    if (!this.dialogOpen) return;
    this.elements.dialog.classList.add('hidden');
    this.dialogOpen = false;
    this.notifyBlocking();
  }

  // -------------------------------------------------------------------------
  // Toasts
  // -------------------------------------------------------------------------

  toast(message, { icon = '✉️', kind = '', duration = 3400 } = {}) {
    const toast = document.createElement('div');
    toast.className = `toast ${kind}`.trim();
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
    this.elements.toasts.appendChild(toast);
    while (this.elements.toasts.children.length > 4) {
      this.elements.toasts.firstElementChild.remove();
    }
    window.setTimeout(() => {
      toast.classList.add('out');
      window.setTimeout(() => toast.remove(), 320);
    }, duration);
  }

  showAchievementToasts(achievements) {
    if (!achievements?.length) return;
    this.audio?.achievement();
    achievements.forEach((achievement, index) => {
      window.setTimeout(() => {
        this.toast(`成就达成 · ${achievement.name}  +${achievement.coins} 金币`, {
          icon: '🏆',
          kind: 'achievement',
          duration: 4600,
        });
      }, index * 650);
    });
  }

  setBusy(value) {
    this.busy = value;
  }

  // -------------------------------------------------------------------------
  // Panels
  // -------------------------------------------------------------------------

  openPanel(tab) {
    if (!this.state) return;
    this.closeDialog();
    this.activePanel = tab;
    this.elements.panelTitle.textContent = PANEL_TITLES[tab] || '邮局';
    this.elements.panel.classList.remove('hidden');
    this.elements.panelBackdrop.classList.remove('hidden');
    this.elements.panelTabs.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });
    this.renderPanel();
    this.notifyBlocking();
    this.audio?.click();
    if (tab === 'news') this.markNewsRead();
    this.api.fetchState().then((state) => {
      if (this.activePanel) this.updateState(state);
    }).catch(() => {});
  }

  closePanel(clicked = true) {
    if (!this.activePanel) return;
    this.activePanel = null;
    this.elements.panel.classList.add('hidden');
    this.elements.panelBackdrop.classList.add('hidden');
    this.notifyBlocking();
    if (clicked) this.audio?.click();
  }

  async markNewsRead() {
    const unreadIds = this.state.announcements
      .filter((announcement) => !announcement.read)
      .map((announcement) => announcement.id);
    if (!unreadIds.length) return;
    const marked = [];
    for (const id of unreadIds) {
      try {
        await this.api.markAnnouncementRead(id);
        marked.push(id);
      } catch {
        // Retry next time the panel opens.
      }
    }
    // The panel also refreshes state in parallel; stamp the ids onto the
    // current state so a late response cannot resurrect the unread badge.
    const current = this.state;
    if (current) {
      for (const announcement of current.announcements) {
        if (marked.includes(announcement.id)) announcement.read = true;
      }
    }
    if (this.api.state && this.api.state !== current) {
      for (const announcement of this.api.state.announcements) {
        if (marked.includes(announcement.id)) announcement.read = true;
      }
    }
    this.updateNewsBadge();
    if (this.activePanel === 'news') this.renderPanel();
  }

  renderPanel() {
    if (!this.activePanel || !this.state) return;
    const renderers = {
      tasks: () => this.renderTasks(),
      collection: () => this.renderCollection(),
      shop: () => this.renderShop(),
      leaderboard: () => this.renderLeaderboard(),
      news: () => this.renderNews(),
    };
    this.elements.panelBody.innerHTML = renderers[this.activePanel]();
    this.bindPanelActions();
  }

  renderTasks() {
    const { tasks } = this.state;
    if (!tasks.length) {
      return '<div class="leader-empty">邮局的小黑板上暂时没有新的任务。</div>';
    }
    return tasks.map((task) => {
      const status = TASK_STATUS[task.status] || { label: task.status, tag: '' };
      const objectives = task.objectives.map((objective) => {
        const percent = Math.min(100, Math.round((objective.progress / Math.max(1, objective.target)) * 100));
        return `
          <div class="obj-label"><span>${escapeHtml(objective.label)}</span><span>${objective.progress} / ${objective.target}</span></div>
          <div class="progress"><i style="width:${percent}%"></i></div>
        `;
      }).join('');

      let action = '<span class="tag">进行中</span>';
      if (task.status === 'available') {
        action = `<button class="btn teal small" data-task-accept="${task.id}">接下任务</button>`;
      } else if (task.status === 'completed') {
        action = `<button class="btn primary small" data-task-claim="${task.id}">领取奖励</button>`;
      } else if (task.status === 'locked') {
        action = '<span class="tag claimed">未解锁</span>';
      } else if (task.status === 'claimed') {
        const cooldown = task.next_available_at_ms
          ? ` · ${timeLeft(task.next_available_at_ms - this.state.server_ms)}`
          : '';
        action = `<span class="tag claimed">已完成${cooldown}</span>`;
      } else if (task.status === 'expired') {
        action = '<span class="tag claimed">已过期</span>';
      } else if (task.status === 'active') {
        action = '<span class="tag">进行中</span>';
      }

      const classes = ['task-card'];
      if (task.status === 'completed') classes.push('done');
      if (task.status === 'claimed') classes.push('claimed');

      return `
        <div class="${classes.join(' ')}">
          <div class="task-top">
            <div class="task-title">${escapeHtml(task.name)}</div>
            <span class="tag ${status.tag}">${status.label}</span>
          </div>
          <div class="task-desc">${escapeHtml(task.description)}</div>
          ${objectives}
          <div class="task-foot">
            <span class="reward-line">🪙 ${task.reward_coins} 金币 · ${escapeHtml(task.category)}</span>
            ${action}
          </div>
        </div>
      `;
    }).join('') + '<p class="panel-footnote">任务进度由 taixu 记录：接取后，投递与交谈都会自动推进。</p>';
  }

  renderCollection() {
    const collection = this.state.collection;
    const receivers = this.world.npcs.filter((npc) => npc.receives_mail);
    const stamps = receivers.map((npc) => {
      const got = collection.stamps.includes(npc.id);
      return `
        <div class="stamp ${got ? 'got' : ''}">
          ${got ? '<span class="stamp-check">✓</span>' : ''}
          <span>${NPC_EMOJI[npc.id] || '✉️'}</span>
          <span class="stamp-name">${got ? escapeHtml(STAMP_NAMES[npc.id] || '邮票') : '未收集'}</span>
        </div>
      `;
    }).join('');

    const milestones = collection.milestones.map((milestone, index) => {
      const rewardText = index === 0 ? '100 金币' : '200 金币 + 星星王冠';
      let action = '<span class="tag claimed">未达成</span>';
      if (milestone.claimed) {
        action = '<span class="tag claimed">已领取</span>';
      } else if (milestone.unlocked) {
        action = `<button class="btn primary small" data-milestone="${milestone.index}">领取</button>`;
      }
      return `
        <div class="milestone-row">
          <span class="ms-icon">${index === 0 ? '📬' : '👑'}</span>
          <span class="ms-text">集齐 ${milestone.required} 张邮票<small>${rewardText}</small></span>
          ${action}
        </div>
      `;
    }).join('');

    const achievements = this.state.achievements.map((achievement) => {
      const percent = Math.min(100, Math.round((achievement.progress / Math.max(1, achievement.target)) * 100));
      return `
        <div class="achievement-row ${achievement.completed ? '' : 'locked'}">
          <div class="ach-icon">${ACHIEVEMENT_ICON[achievement.id] || '🏅'}</div>
          <div class="ach-body">
            <div class="ach-name">${escapeHtml(achievement.name)}</div>
            <div class="ach-desc">${escapeHtml(achievement.description)}</div>
          </div>
          <div class="ach-progress">${achievement.claimed ? '已达成' : `${achievement.progress}/${achievement.target}`}<br>${achievement.completed ? (achievement.claimed ? '<span class="ach-done">✓</span>' : `+${achievement.coins}🪙`) : `${percent}%`}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="panel-section-title"><span>邮票 · ${collection.collected}/${collection.total}</span><span>${Math.round((collection.collected / Math.max(1, collection.total)) * 100)}%</span></div>
      <div class="stamp-grid">${stamps}</div>
      <div class="panel-section-title"><span>里程碑</span></div>
      ${milestones}
      <div class="panel-section-title"><span>旅途成就</span><span>自动领取</span></div>
      ${achievements}
      <p class="panel-footnote">每送出一封信，就会得到收信人的邮票。重复投递不会重复集邮。</p>
    `;
  }

  renderShop() {
    const player = this.state.player;
    const owned = player.hats_owned || [];
    const wardrobe = owned.map((hat) => `
      <div class="hat-row">
        <div class="hat-preview">${HAT_EMOJI[hat.id] || '🧢'}</div>
        <div class="hat-info">
          <div class="hat-name">${escapeHtml(hat.label)}</div>
          <div class="hat-desc">${hat.id === 'hat_crown' ? '集邮册的礼物，夜里会微微发光。' : '已经放进你的衣柜。'}</div>
        </div>
        <div class="hat-actions">
          ${hat.equipped ? '<span class="equipped-tag">正在戴</span>' : `<button class="btn ghost small" data-equip="${hat.id}">戴上</button>`}
        </div>
      </div>
    `).join('');

    const forSale = this.state.shop.filter((item) => !item.owned).map((item) => `
      <div class="hat-row">
        <div class="hat-preview">${HAT_EMOJI[item.skin] || '🎩'}</div>
        <div class="hat-info">
          <div class="hat-name">${escapeHtml(item.name)}</div>
          <div class="hat-desc">${escapeHtml(item.description)}</div>
          <div class="hat-price">🪙 ${item.price} 金币</div>
        </div>
        <div class="hat-actions">
          <button class="btn primary small" data-buy="${item.id}" ${player.coins < item.price ? 'disabled' : ''}>购买</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="panel-section-title"><span>我的衣柜 · ${owned.length}</span><span>🪙 ${player.coins}</span></div>
      ${wardrobe || '<div class="leader-empty">衣柜还空着。</div>'}
      <div class="panel-section-title"><span>帽子铺</span><span>用金币交换</span></div>
      ${forSale || '<div class="leader-empty">帽子铺的东西都被你买光啦。</div>'}
      <p class="panel-footnote">帽子通过 taixu 皮肤发放，每个账号限购一顶。星星王冠只能从集邮册获得。</p>
    `;
  }

  renderLeaderboard() {
    const rows = this.state.leaderboard.map((entry, index) => {
      const medal = ['🥇', '🥈', '🥉'][index] || entry.rank;
      const mine = this.state.player.id && entry.id === this.state.player.id;
      return `
        <div class="leader-row ${mine ? 'me' : ''}">
          <div class="leader-rank">${medal}</div>
          <div class="leader-name">${escapeHtml(entry.name)}${mine ? ' · 你' : ''}</div>
          <div class="leader-score">${entry.score} 封</div>
        </div>
      `;
    }).join('');

    const myRank = this.state.my_rank
      ? `<p class="panel-footnote">你目前排在第 ${this.state.my_rank} 名，累计送出 ${this.state.player.deliveries} 封信。</p>`
      : '<p class="panel-footnote">送出第一封信，就能登上榜单。</p>';

    return `
      <div class="panel-section-title"><span>累计投递</span><span>TOP 8</span></div>
      ${rows || '<div class="leader-empty">还没有人开始送信，第一名在等你。</div>'}
      ${myRank}
    `;
  }

  renderNews() {
    if (!this.state.announcements.length) {
      return '<div class="leader-empty">公告栏空空的，只有一张被风吹起的纸。</div>';
    }
    return this.state.announcements.map((announcement) => `
      <article class="news-card ${announcement.read ? '' : 'unread'}">
        <div class="stamp-corner">✉️</div>
        <div class="news-kind">${KIND_LABELS[announcement.kind] || '公告'}${announcement.read ? '' : ' · 未读'}</div>
        <div class="news-title">${escapeHtml(announcement.title)}</div>
        <div class="news-body">${escapeHtml(announcement.body).replace(/\n/g, '<br>')}</div>
      </article>
    `).join('');
  }

  bindPanelActions() {
    this.elements.panelBody.querySelectorAll('[data-task-accept]').forEach((button) => {
      button.addEventListener('click', () => this.runAction(
        () => this.api.acceptTask(button.dataset.taskAccept),
        { fallback: '任务已接下。' },
      ));
    });
    this.elements.panelBody.querySelectorAll('[data-task-claim]').forEach((button) => {
      button.addEventListener('click', () => this.runAction(
        () => this.api.claimTask(button.dataset.taskClaim),
        { fallback: '奖励已领取。' },
      ));
    });
    this.elements.panelBody.querySelectorAll('[data-milestone]').forEach((button) => {
      button.addEventListener('click', () => this.runAction(
        () => this.api.claimMilestone(Number(button.dataset.milestone)),
        { fallback: '里程碑奖励已领取。' },
      ));
    });
    this.elements.panelBody.querySelectorAll('[data-buy]').forEach((button) => {
      button.addEventListener('click', () => this.runAction(
        () => this.api.purchase(button.dataset.buy),
        { fallback: '买到新帽子啦。' },
      ));
    });
    this.elements.panelBody.querySelectorAll('[data-equip]').forEach((button) => {
      button.addEventListener('click', () => this.runAction(
        () => this.api.equip(button.dataset.equip),
        { fallback: '换好帽子了。' },
      ));
    });
  }

  async runAction(request, { fallback = '完成啦。' } = {}) {
    if (this.busy) return;
    this.setBusy(true);
    try {
      const response = await request();
      this.audio?.click();
      if (response.state) this.updateState(response.state);
      this.toast(response.message || fallback, { icon: '✉️' });
      if (response.achievements?.length) this.showAchievementToasts(response.achievements);
      if (this.activePanel) this.renderPanel();
    } catch (error) {
      this.audio?.error();
      this.toast(error.message || '小星球打了个喷嚏，再试一次吧。', { icon: '⚠️', kind: 'error' });
    } finally {
      this.setBusy(false);
    }
  }

  // -------------------------------------------------------------------------
  // Static event bindings
  // -------------------------------------------------------------------------

  bindStaticEvents() {
    const start = async () => {
      const name = this.elements.nameInput.value.trim() || '旅人';
      localStorage.setItem('tiny-messenger-name', name);
      this.setStarting();
      try {
        await this.handlers.onStart?.(name);
      } catch (error) {
        this.audio?.error();
        this.showTitleError(error.message || '风太大，信没有送出去。');
      }
    };
    this.elements.startButton.addEventListener('click', start);
    this.elements.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') start();
    });

    this.elements.panelTabs.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-tab]');
      if (!button) return;
      this.openPanel(button.dataset.tab);
    });
    this.elements.panelClose.addEventListener('click', () => this.closePanel());
    this.elements.panelBackdrop.addEventListener('click', () => this.closePanel());
    this.elements.dialogClose.addEventListener('click', () => this.closeDialog());

    document.querySelectorAll('[data-panel]').forEach((button) => {
      button.addEventListener('click', () => this.openPanel(button.dataset.panel));
    });

    this.elements.soundToggle.addEventListener('click', async () => {
      await this.audio?.start();
      const muted = this.audio?.toggle();
      this.updateSoundIcon(muted);
      if (!muted) this.audio?.click();
    });

    this.elements.emoteBar.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-emote]');
      if (!button) return;
      this.handlers.onEmote?.(button.dataset.emote);
    });

    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!this.state) return;
      if (event.code === 'Escape') {
        this.closeDialog();
        this.closePanel(false);
        return;
      }
      const number = event.code.match(/^Digit([1-6])$/);
      if (number) {
        const emote = this.world.emotes[Number(number[1]) - 1];
        if (emote) this.handlers.onEmote?.(emote);
        return;
      }
      const shortcuts = { KeyT: 'tasks', KeyC: 'collection', KeyH: 'shop', KeyL: 'leaderboard', KeyN: 'news' };
      if (shortcuts[event.code] && !this.dialogOpen) {
        this.openPanel(shortcuts[event.code]);
      }
    });

    this.setupJoystick();
    this.elements.jumpButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.handlers.onJump?.();
    });
    this.elements.interactButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.handlers.onInteract?.();
    });

    document.addEventListener('visibilitychange', () => {
      if (!this.audio?.started) return;
      if (document.hidden) this.audio.ctx?.suspend();
      else if (!this.audio.muted) this.audio.ctx?.resume();
    });
  }

  setupJoystick() {
    const joystick = this.elements.joystick;
    const knob = this.elements.joystickKnob;
    let pointerId = null;
    let centerX = 0;
    let centerY = 0;
    const radius = 42;

    const update = (event) => {
      let dx = event.clientX - centerX;
      let dy = event.clientY - centerY;
      const length = Math.hypot(dx, dy);
      if (length > radius) {
        dx = (dx / length) * radius;
        dy = (dy / length) * radius;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.handlers.onJoystick?.(dx / radius, dy / radius);
    };

    joystick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      pointerId = event.pointerId;
      const rect = joystick.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      joystick.setPointerCapture?.(event.pointerId);
      update(event);
    });
    joystick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      update(event);
    });
    const end = (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      knob.style.transform = 'translate(-50%, -50%)';
      this.handlers.onJoystick?.(0, 0);
    };
    joystick.addEventListener('pointerup', end);
    joystick.addEventListener('pointercancel', end);
  }

  updateSoundIcon(forceMuted) {
    const muted = forceMuted === undefined ? this.audio?.isMuted : forceMuted;
    this.elements.soundToggle.textContent = muted ? '🔕' : '🔔';
    this.elements.soundToggle.classList.toggle('sound-off', muted);
  }
}

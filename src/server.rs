//! HTTP facade over the taixu game state and the tiny amount of real-time
//! presence this pocket planet needs.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use taixu::prelude::*;

use crate::store::FileStore;
use crate::world::*;

#[derive(Clone)]
pub struct AppState {
    pub game: Arc<Game>,
    pub store: Arc<FileStore>,
    pub presence: Arc<Mutex<HashMap<String, Presence>>>,
    pub started_ms: i64,
}

#[derive(Clone)]
pub struct Presence {
    name: String,
    level: u32,
    dir: [f64; 3],
    heading: f64,
    hat: String,
    emote: Option<(String, i64)>,
    last_seen_ms: i64,
}

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct LoginBody {
    account_id: Option<String>,
    name: String,
}

#[derive(Deserialize)]
struct NearBody {
    dir: [f64; 3],
    #[serde(default)]
    heading: f64,
}

#[derive(Deserialize)]
struct DeliverBody {
    npc_id: String,
    dir: [f64; 3],
    #[serde(default)]
    heading: f64,
}

#[derive(Deserialize)]
struct HeartbeatBody {
    dir: [f64; 3],
    #[serde(default)]
    heading: f64,
    emote: Option<String>,
}

#[derive(Deserialize)]
struct OfferBody {
    offer_id: String,
}

#[derive(Deserialize)]
struct SkinBody {
    skin_id: String,
}

#[derive(Serialize)]
struct LoginResponse {
    account_id: String,
    welcome: bool,
    state: StateDto,
}

#[derive(Serialize)]
struct ActionResponse {
    message: String,
    achievements: Vec<AchievementToastDto>,
    state: StateDto,
}

#[derive(Serialize)]
struct TalkResponse {
    line: String,
    npc_name: String,
    npc_title: String,
    met_new: bool,
    achievements: Vec<AchievementToastDto>,
    state: StateDto,
}

#[derive(Serialize)]
struct AchievementToastDto {
    name: String,
    coins: u64,
}

#[derive(Serialize)]
struct StateDto {
    player: PlayerDto,
    letter: Option<LetterDto>,
    tasks: Vec<TaskDto>,
    achievements: Vec<AchievementDto>,
    collection: CollectionDto,
    shop: Vec<ShopItemDto>,
    leaderboard: Vec<LeaderDto>,
    my_rank: Option<usize>,
    announcements: Vec<AnnouncementDto>,
    online: usize,
    server_ms: i64,
}

#[derive(Serialize)]
struct PlayerDto {
    id: String,
    name: String,
    level: u32,
    xp: u64,
    coins: u64,
    deliveries: i64,
    hat: String,
    hats_owned: Vec<HatDto>,
    stamps: Vec<String>,
}

#[derive(Serialize)]
struct HatDto {
    id: String,
    label: String,
    equipped: bool,
}

#[derive(Serialize)]
struct LetterDto {
    item_id: String,
    npc_id: String,
    npc_name: String,
    npc_title: String,
    place_name: String,
    stamp_name: String,
}

#[derive(Serialize)]
struct TaskDto {
    id: String,
    name: String,
    description: String,
    category: String,
    status: String,
    objectives: Vec<ObjectiveDto>,
    reward_coins: u64,
    next_available_at_ms: Option<i64>,
}

#[derive(Serialize)]
struct ObjectiveDto {
    label: String,
    progress: u64,
    target: u64,
    complete: bool,
}

#[derive(Serialize)]
struct AchievementDto {
    id: String,
    name: String,
    description: String,
    progress: u64,
    target: u64,
    completed: bool,
    claimed: bool,
    coins: u64,
}

#[derive(Serialize)]
struct CollectionDto {
    collected: usize,
    total: usize,
    stamps: Vec<String>,
    milestones: Vec<MilestoneDto>,
}

#[derive(Serialize)]
struct MilestoneDto {
    index: usize,
    required: usize,
    unlocked: bool,
    claimed: bool,
}

#[derive(Serialize)]
struct ShopItemDto {
    id: String,
    name: String,
    description: String,
    price: u64,
    skin: String,
    label: String,
    owned: bool,
    equipped: bool,
}

#[derive(Serialize)]
struct LeaderDto {
    rank: usize,
    id: String,
    name: String,
    score: i64,
}

#[derive(Serialize)]
struct AnnouncementDto {
    id: String,
    title: String,
    body: String,
    kind: String,
    read: bool,
}

#[derive(Serialize)]
struct HeartbeatDto {
    online: usize,
    players: Vec<PresenceDto>,
    server_ms: i64,
}

#[derive(Serialize)]
struct PresenceDto {
    id: String,
    name: String,
    dir: [f64; 3],
    heading: f64,
    hat: String,
    emote: Option<String>,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

pub struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
        }
    }

    fn bad(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code, message)
    }

    fn unauthorized() -> Self {
        Self::new(
            StatusCode::UNAUTHORIZED,
            "UNAUTHENTICATED",
            "先告诉我你的名字吧。",
        )
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({ "error": self.code, "message": self.message })),
        )
            .into_response()
    }
}

impl From<GameError> for ApiError {
    fn from(error: GameError) -> Self {
        match error {
            GameError::AccountNotFound(_) => Self::unauthorized(),
            GameError::InvalidName(_) => {
                Self::bad("INVALID_NAME", "名字太长了，换一个短一点的吧。")
            }
            GameError::InventoryFull => Self::bad("INVENTORY_FULL", "背包满了，先送掉手上的信吧。"),
            GameError::InsufficientItems { .. } => Self::bad("NO_LETTER", "你手上没有这封信。"),
            GameError::InsufficientFunds { .. } => {
                Self::bad("NO_COINS", "金币还不够，再送几封信吧。")
            }
            GameError::AlreadyClaimed
            | GameError::AchievementAlreadyClaimed
            | GameError::TaskAlreadyClaimed(_) => {
                Self::bad("ALREADY_CLAIMED", "这份奖励已经领过啦。")
            }
            GameError::TaskLocked(_) => Self::bad("TASK_LOCKED", "这个任务还没有解锁。"),
            GameError::TaskOnCooldown {
                available_at_ms, ..
            } => Self::bad(
                "TASK_COOLDOWN",
                format!("任务还在冷却中，{available_at_ms} 之后再回来吧。"),
            ),
            GameError::TaskNotCompleted(_) => Self::bad("TASK_INCOMPLETE", "任务还没有完成。"),
            GameError::TaskNotAccepted(_) => Self::bad("TASK_NOT_ACCEPTED", "先接下这个任务。"),
            GameError::TaskAlreadyAccepted(_) => Self::bad("TASK_TAKEN", "已经接下这个任务了。"),
            GameError::SkinNotOwned(_) => Self::bad("SKIN_NOT_OWNED", "你还没有这顶帽子。"),
            GameError::PurchaseLimitReached => Self::bad("PURCHASE_LIMIT", "这件东西已经买过了。"),
            GameError::MilestoneLocked => Self::bad("MILESTONE_LOCKED", "邮票还没集齐。"),
            GameError::RegionNotOpen(_) => Self::bad("REGION_CLOSED", "星球暂时打烊了。"),
            other => Self::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "GAME_ERROR",
                other.to_string(),
            ),
        }
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(api_health))
        .route("/api/world", get(api_world))
        .route("/api/login", post(api_login))
        .route("/api/state", get(api_state))
        .route("/api/heartbeat", post(api_heartbeat))
        .route("/api/logout", post(api_logout))
        .route("/api/letter/accept", post(api_accept_letter))
        .route("/api/letter/deliver", post(api_deliver))
        .route("/api/talk", post(api_talk))
        .route("/api/tasks/{id}/accept", post(api_accept_task))
        .route("/api/tasks/{id}/claim", post(api_claim_task))
        .route("/api/collection/{index}/claim", post(api_claim_milestone))
        .route("/api/shop/purchase", post(api_purchase))
        .route("/api/avatar/equip", post(api_equip))
        .route("/api/announcements/{id}/read", post(api_read_announcement))
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn api_health(State(state): State<AppState>) -> Json<serde_json::Value> {
    let online = online_count(&state);
    Json(json!({
        "ok": true,
        "online": online,
        "uptime_ms": now_ms() - state.started_ms,
        "planet": "微光星球",
    }))
}

async fn api_world(_: State<AppState>) -> Json<WorldDto> {
    Json(world_dto())
}

async fn api_login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> Result<Json<LoginResponse>, ApiError> {
    let (account_id, generated) = match body.account_id.as_deref() {
        Some(id) if valid_account_id(id) => (id.to_string(), false),
        Some(_) => {
            return Err(ApiError::bad("BAD_ACCOUNT", "访客凭证格式不对。"));
        }
        None => (format!("g-{:016x}", rand::random::<u64>()), true),
    };

    let name = clean_name(&body.name);
    if name.is_empty() {
        return Err(ApiError::bad("EMPTY_NAME", "先取一个名字再出发吧。"));
    }

    let existing = state.game.account(&account_id.clone().into()).is_ok();
    let account = state
        .game
        .ensure_account(account_id.as_str(), &name, REGION_ID)?;
    if !existing {
        state
            .game
            .grant_reward(&account.id, &Reward::new().currency(COIN, 40).xp(10))?;
        // Give new posties a first delivery on the board right away; the
        // other tasks are deliberately opt-in.
        let _ = state.game.accept_task(&account.id, &"first_letter".into());
    }
    if account.display_name != name {
        state.game.update_display_name(&account.id, &name)?;
    }
    ensure_default_hat(&state.game, &account.id)?;
    refresh_level(&state.game, &account.id)?;
    state.game.login(&account.id)?;
    persist(&state);

    let state_dto = build_state(&state, &account.id)?;
    Ok(Json(LoginResponse {
        account_id: account.id.as_str().to_string(),
        welcome: generated || !existing,
        state: state_dto,
    }))
}

async fn api_state(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<StateDto>, ApiError> {
    let account = authenticate(&headers, &state)?;
    Ok(Json(build_state(&state, &account)?))
}

async fn api_heartbeat(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<HeartbeatBody>,
) -> Result<Json<HeartbeatDto>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let dir = normalize_dir(body.dir)?;
    let account_record = state.game.account(&account)?;
    let hat = current_hat(&state.game, &account)?;
    state.game.heartbeat(&account)?;

    let now = now_ms();
    let mut presence = state.presence.lock().expect("presence lock");
    presence.retain(|_, entry| now - entry.last_seen_ms < 30_000);

    let emote = body.emote.filter(|value| EMOTES.contains(&value.as_str()));
    let entry = presence
        .entry(account.as_str().to_string())
        .or_insert_with(|| Presence {
            name: account_record.display_name.clone(),
            level: account_record.level,
            dir,
            heading: body.heading,
            hat: hat.clone(),
            emote: None,
            last_seen_ms: now,
        });
    entry.name = account_record.display_name.clone();
    entry.level = account_record.level;
    entry.dir = dir;
    entry.heading = body.heading;
    entry.hat = hat;
    entry.last_seen_ms = now;
    if let Some(value) = emote {
        entry.emote = Some((value, now));
    }

    let mut players = Vec::new();
    let mut online = 0;
    for (id, other) in presence.iter() {
        if now - other.last_seen_ms > 15_000 {
            continue;
        }
        online += 1;
        if id == account.as_str() {
            continue;
        }
        players.push(PresenceDto {
            id: id.clone(),
            name: other.name.clone(),
            dir: other.dir,
            heading: other.heading,
            hat: other.hat.clone(),
            emote: other
                .emote
                .as_ref()
                .filter(|(_, at)| now - *at < 4_000)
                .map(|(value, _)| value.clone()),
        });
    }
    drop(presence);

    Ok(Json(HeartbeatDto {
        online: online.max(1),
        players,
        server_ms: now,
    }))
}

async fn api_logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let account = authenticate(&headers, &state)?;
    state.game.logout(&account)?;
    state
        .presence
        .lock()
        .expect("presence lock")
        .remove(account.as_str());
    persist(&state);
    Ok(Json(json!({ "ok": true })))
}

async fn api_accept_letter(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<NearBody>,
) -> Result<Json<ActionResponse>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let dir = normalize_dir(body.dir)?;
    ensure_near(dir, post_dir(), 0.30, "再靠近邮局一点")?;

    let inventory = state.game.inventory(&account)?;
    if let Some(stack) = inventory
        .slots()
        .iter()
        .flatten()
        .find(|stack| stack.item().as_str().starts_with("letter_"))
    {
        let npc = letter_from_item(stack.item().as_str());
        let who = npc.map(|npc| npc.name).unwrap_or("一位居民");
        return Err(ApiError::bad(
            "LETTER_PENDING",
            format!("你手里还有一封写给{who}的信，先送出去吧。"),
        ));
    }

    let account_record = state.game.account(&account)?;
    let last = account_record.metadata.get("last_letter").cloned();
    let candidates: Vec<&NpcSpec> = letter_targets()
        .filter(|npc| Some(npc.id.to_string()) != last)
        .collect();
    let candidates = if candidates.is_empty() {
        letter_targets().collect()
    } else {
        candidates
    };
    let npc = candidates[rand::random_range(0..candidates.len())];

    let item: ItemId = letter_item(npc.id).into();
    state.game.add_item(&account, &item, 1)?;
    state
        .game
        .set_account_metadata(&account, "last_letter", npc.id)?;

    let place = place_by_id(npc.place)
        .map(|place| place.name)
        .unwrap_or("远方");
    update_presence_dir(&state, &account, dir, body.heading, &state.game)?;
    persist(&state);
    let response_state = build_state(&state, &account)?;

    Ok(Json(ActionResponse {
        message: format!("波比递来一封信：「送去{place}，交给{}。」", npc.name),
        achievements: Vec::new(),
        state: response_state,
    }))
}

async fn api_deliver(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<DeliverBody>,
) -> Result<Json<ActionResponse>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let dir = normalize_dir(body.dir)?;
    let npc = npc_by_id(&body.npc_id)
        .filter(|npc| npc.receives_mail)
        .ok_or_else(|| ApiError::bad("NO_SUCH_NPC", "这里没有可以收信的人。"))?;
    ensure_near(dir, npc_dir(npc), 0.24, "离收信人再近一点")?;

    let item: ItemId = letter_item(npc.id).into();
    if state.game.item_count(&account, &item)? == 0 {
        return Err(ApiError::bad(
            "NO_LETTER",
            format!("你手上没有写给{}的信。", npc.name),
        ));
    }
    state.game.remove_item(&account, &item, 1)?;

    state
        .game
        .grant_reward(&account, &Reward::new().currency(COIN, 35).xp(15))?;
    state
        .game
        .add_leaderboard_score(&DELIVERY_BOARD.into(), &account, 1)?;

    let stamp: ItemId = stamp_item(npc.id).into();
    let new_stamp = state.game.item_count(&account, &stamp)? == 0;
    if new_stamp {
        state.game.add_item(&account, &stamp, 1)?;
        state.game.record_event(&account, "stamp", 1)?;
    }
    state.game.record_event(&account, "delivery", 1)?;
    let achievements = claim_completed_achievements(&state.game, &account)?;
    refresh_level(&state.game, &account)?;

    update_presence_dir(&state, &account, dir, body.heading, &state.game)?;
    persist(&state);
    let response_state = build_state(&state, &account)?;

    let mut message = npc.thanks.to_string();
    if new_stamp {
        message.push_str(&format!(" 获得邮票「{}」。", npc.stamp_name));
    }
    Ok(Json(ActionResponse {
        message,
        achievements,
        state: response_state,
    }))
}

async fn api_talk(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<DeliverBody>,
) -> Result<Json<TalkResponse>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let dir = normalize_dir(body.dir)?;
    let npc = npc_by_id(&body.npc_id)
        .ok_or_else(|| ApiError::bad("NO_SUCH_NPC", "这里没有人可以交谈。"))?;
    ensure_near(dir, npc_dir(npc), 0.24, "走近一点再说话")?;

    let account_record = state.game.account(&account)?;
    let met_key = format!("met_{}", npc.id);
    let met_new = !account_record.metadata.contains_key(&met_key);
    if met_new {
        state.game.set_account_metadata(&account, met_key, "1")?;
        state.game.record_event(&account, "meet", 1)?;
    }
    let achievements = claim_completed_achievements(&state.game, &account)?;

    let line = npc.lines[rand::random_range(0..npc.lines.len())].to_string();
    update_presence_dir(&state, &account, dir, body.heading, &state.game)?;
    if met_new {
        persist(&state);
    }
    let response_state = build_state(&state, &account)?;

    Ok(Json(TalkResponse {
        line,
        npc_name: npc.name.to_string(),
        npc_title: npc.title.to_string(),
        met_new,
        achievements,
        state: response_state,
    }))
}

async fn api_accept_task(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ActionResponse>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let task: TaskId = id.clone().into();
    state.game.accept_task(&account, &task)?;
    persist(&state);
    let response_state = build_state(&state, &account)?;
    Ok(Json(ActionResponse {
        message: "任务已接下，慢慢来就好。".into(),
        achievements: Vec::new(),
        state: response_state,
    }))
}

async fn api_claim_task(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ActionResponse>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let task: TaskId = id.into();
    let reward = state.game.claim_task(&account, &task)?;
    let coins = coin_reward(&reward);
    refresh_level(&state.game, &account)?;
    persist(&state);
    let response_state = build_state(&state, &account)?;
    Ok(Json(ActionResponse {
        message: format!("任务完成！获得 {coins} 枚金币。"),
        achievements: Vec::new(),
        state: response_state,
    }))
}

async fn api_claim_milestone(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(index): Path<usize>,
) -> Result<Json<ActionResponse>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let collection: CollectionId = STAMP_ALBUM.into();
    let reward = state
        .game
        .claim_collection_milestone(&account, &collection, index)?;
    let coins = coin_reward(&reward);
    let mut message = format!("集邮里程碑达成！获得 {coins} 枚金币。");
    if reward.skins.iter().any(|skin| skin.as_str() == "hat_crown") {
        message = "集齐六张邮票！获得「星星王冠」，已经放进衣柜。".into();
    }
    persist(&state);
    let response_state = build_state(&state, &account)?;
    Ok(Json(ActionResponse {
        message,
        achievements: Vec::new(),
        state: response_state,
    }))
}

async fn api_purchase(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<OfferBody>,
) -> Result<Json<ActionResponse>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let shop_id: ShopId = HAT_SHOP.into();
    let offer_id: OfferId = body.offer_id.clone().into();
    let receipt = state.game.purchase(&account, &shop_id, &offer_id, 1)?;
    let mut message = "买到新帽子啦。".to_string();
    if let Some(skin) = receipt.received.skins.first() {
        state.game.equip_skin(&account, skin)?;
        message = format!("买到了「{}」，已经戴上。", hat_label(skin.as_str()));
    }
    persist(&state);
    let response_state = build_state(&state, &account)?;
    Ok(Json(ActionResponse {
        message,
        achievements: Vec::new(),
        state: response_state,
    }))
}

async fn api_equip(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SkinBody>,
) -> Result<Json<ActionResponse>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let skin: SkinId = body.skin_id.clone().into();
    state.game.equip_skin(&account, &skin)?;
    persist(&state);
    let response_state = build_state(&state, &account)?;
    Ok(Json(ActionResponse {
        message: format!("换上了「{}」。", hat_label(&body.skin_id)),
        achievements: Vec::new(),
        state: response_state,
    }))
}

async fn api_read_announcement(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let account = authenticate(&headers, &state)?;
    let announcement: AnnouncementId = id.into();
    state.game.mark_announcement_read(&account, &announcement)?;
    persist(&state);
    Ok(Json(json!({ "ok": true })))
}

// ---------------------------------------------------------------------------
// State assembly
// ---------------------------------------------------------------------------

fn build_state(state: &AppState, account: &AccountId) -> Result<StateDto, ApiError> {
    let game = &state.game;
    let account_record = game.account(account)?;
    let wallet = game.wallet(account)?;
    let coins = wallet
        .currencies
        .iter()
        .find(|(id, _)| id.as_str() == COIN)
        .map(|(_, amount)| *amount)
        .unwrap_or(0);
    let inventory = game.inventory(account)?;

    let mut stamps = Vec::new();
    let mut letter_stack = None;
    for stack in inventory.slots().iter().flatten() {
        let id = stack.item().as_str();
        if let Some(npc_id) = id.strip_prefix("stamp_") {
            stamps.push(npc_id.to_string());
        }
        if id.starts_with("letter_") && letter_stack.is_none() {
            letter_stack = Some(stack.item().clone());
        }
    }
    stamps.sort_by_key(|id| {
        NPCS.iter()
            .position(|npc| npc.id == id.as_str())
            .unwrap_or(usize::MAX)
    });
    stamps.dedup();

    let letter = letter_stack.and_then(|item| {
        let npc = letter_from_item(item.as_str())?;
        let place = place_by_id(npc.place)?;
        Some(LetterDto {
            item_id: item.as_str().to_string(),
            npc_id: npc.id.to_string(),
            npc_name: npc.name.to_string(),
            npc_title: npc.title.to_string(),
            place_name: place.name.to_string(),
            stamp_name: npc.stamp_name.to_string(),
        })
    });

    let equipped = game.equipped_skins(account)?;
    let hat = equipped
        .get(&SkinCategory::Character)
        .map(|skin| skin.as_str().to_string())
        .unwrap_or_else(|| DEFAULT_HAT.to_string());

    let owned = game.owned_skins(account)?;
    let owned_hats: Vec<HatDto> = HAT_ORDER
        .iter()
        .filter(|id| owned.owned().iter().any(|skin| skin.as_str() == **id))
        .map(|id| HatDto {
            id: (*id).to_string(),
            label: hat_label(id).to_string(),
            equipped: *id == hat,
        })
        .collect();

    let deliveries = game
        .leaderboard_score(&DELIVERY_BOARD.into(), account)?
        .unwrap_or(0);

    let mut tasks: Vec<TaskDto> = game.task_views(account)?.iter().map(task_dto).collect();
    tasks.sort_by_key(|task| task_order(&task.status));

    let achievements = game
        .achievements_for(account)?
        .iter()
        .map(|view| {
            let coins = game
                .achievement(&view.id)
                .map(|def| coin_reward(&def.reward))
                .unwrap_or(0);
            AchievementDto {
                id: view.id.as_str().to_string(),
                name: view.name.clone(),
                description: view.description.clone(),
                progress: view.progress,
                target: view.target,
                completed: view.completed,
                claimed: view.claimed,
                coins,
            }
        })
        .collect();

    let collection_id: CollectionId = STAMP_ALBUM.into();
    let progress = game.collection_progress(account, &collection_id)?;
    let collection = CollectionDto {
        collected: progress.collected,
        total: progress.total,
        stamps: stamps.clone(),
        milestones: progress
            .milestones
            .iter()
            .map(|milestone| MilestoneDto {
                index: milestone.index,
                required: milestone.required,
                unlocked: milestone.unlocked,
                claimed: milestone.claimed,
            })
            .collect(),
    };

    let shop_id: ShopId = HAT_SHOP.into();
    let shop = game.shop(&shop_id)?;
    let mut shop_items = Vec::new();
    for offer_id in SHOP_OFFERS {
        let Some(offer) = shop.offer(&(*offer_id).into()) else {
            continue;
        };
        let skin = offer
            .reward
            .skins
            .first()
            .map(|skin| skin.as_str().to_string())
            .unwrap_or_default();
        let owned_skin = owned.owned().iter().any(|s| s.as_str() == skin);
        shop_items.push(ShopItemDto {
            id: offer.id.as_str().to_string(),
            name: offer.name.clone(),
            description: offer.description.clone(),
            price: coin_cost(&offer.cost),
            label: hat_label(&skin).to_string(),
            equipped: skin == hat,
            skin,
            owned: owned_skin,
        });
    }

    let board_id: LeaderboardId = DELIVERY_BOARD.into();
    let leaderboard = game
        .leaderboard_top(&board_id, 8)?
        .iter()
        .map(|entry| LeaderDto {
            rank: entry.rank,
            id: entry.account.as_str().to_string(),
            name: game
                .account(&entry.account)
                .map(|account| account.display_name)
                .unwrap_or_else(|_| "旅人".into()),
            score: entry.score,
        })
        .collect();
    let my_rank = game.leaderboard_rank(&board_id, account)?;

    let unread = game.unread_announcements(account)?;
    let announcements = game
        .active_announcements(account)?
        .iter()
        .map(|announcement| AnnouncementDto {
            id: announcement.id.as_str().to_string(),
            title: announcement.title.clone(),
            body: announcement.body.clone(),
            kind: match announcement.kind {
                AnnouncementKind::News => "news",
                AnnouncementKind::Event => "event",
                AnnouncementKind::Maintenance => "maintenance",
                AnnouncementKind::Promotion => "promotion",
                AnnouncementKind::System => "system",
            }
            .to_string(),
            read: !unread
                .iter()
                .any(|item| item.id.as_str() == announcement.id.as_str()),
        })
        .collect();

    Ok(StateDto {
        player: PlayerDto {
            id: account.as_str().to_string(),
            name: account_record.display_name,
            level: account_record.level,
            xp: account_record.xp,
            coins,
            deliveries,
            hat,
            hats_owned: owned_hats,
            stamps,
        },
        letter,
        tasks,
        achievements,
        collection,
        shop: shop_items,
        leaderboard,
        my_rank,
        announcements,
        online: online_count(state),
        server_ms: now_ms(),
    })
}

fn task_dto(view: &TaskView) -> TaskDto {
    let status = match view.status {
        TaskStatus::Available => "available",
        TaskStatus::Locked => "locked",
        TaskStatus::Active => "active",
        TaskStatus::Completed => "completed",
        TaskStatus::Claimed => "claimed",
        TaskStatus::Expired => "expired",
    };
    TaskDto {
        id: view.id.as_str().to_string(),
        name: view.name.clone(),
        description: view.description.clone(),
        category: view.category.clone(),
        status: status.to_string(),
        objectives: view
            .objectives
            .iter()
            .map(|objective| ObjectiveDto {
                label: match &objective.objective {
                    TaskObjective::Metric { metric, .. } => task_metric_label(metric).to_string(),
                    TaskObjective::Item { .. } => "收集道具".to_string(),
                    TaskObjective::Skin { .. } => "收集装扮".to_string(),
                    TaskObjective::Achievement { .. } => "达成成就".to_string(),
                },
                progress: objective.progress,
                target: objective.target,
                complete: objective.complete,
            })
            .collect(),
        reward_coins: coin_reward(&view.reward),
        next_available_at_ms: view.next_available_at_ms,
    }
}

fn task_order(status: &str) -> u8 {
    match status {
        "completed" => 0,
        "active" => 1,
        "available" => 2,
        "locked" => 3,
        "claimed" => 4,
        _ => 5,
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHOP_OFFERS: &[&str] = &["straw", "flower", "sailor"];

const HAT_ORDER: &[&str] = &[
    "hat_postman",
    "hat_straw",
    "hat_flower",
    "hat_sailor",
    "hat_crown",
];

fn authenticate(headers: &HeaderMap, state: &AppState) -> Result<AccountId, ApiError> {
    let raw = headers
        .get("x-guest-id")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;
    if !valid_account_id(raw) {
        return Err(ApiError::unauthorized());
    }
    let account: AccountId = raw.to_string().into();
    state
        .game
        .account(&account)
        .map_err(|_| ApiError::unauthorized())?;
    Ok(account)
}

fn valid_account_id(id: &str) -> bool {
    (6..=64).contains(&id.len())
        && id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_".contains(character))
}

fn clean_name(raw: &str) -> String {
    raw.chars()
        .filter(|character| !character.is_control())
        .collect::<String>()
        .trim()
        .chars()
        .take(16)
        .collect()
}

fn refresh_level(game: &Game, account: &AccountId) -> Result<(), GameError> {
    let record = game.account(account)?;
    // A relaxed XP curve: one delivery is a meaningful step toward the next
    // little level, but the number never becomes the point of the game.
    let level = ((1 + record.xp / 120).min(60)) as u32;
    if level > record.level {
        game.set_level(account, level)?;
    }
    Ok(())
}

fn ensure_default_hat(game: &Game, account: &AccountId) -> Result<(), GameError> {
    if !game.owns_skin(account, &DEFAULT_HAT.into())? {
        game.grant_skin(account, &DEFAULT_HAT.into())?;
    }
    let equipped = game.equipped_skins(account)?;
    if !equipped.contains_key(&SkinCategory::Character) {
        game.equip_skin(account, &DEFAULT_HAT.into())?;
    }
    Ok(())
}

fn current_hat(game: &Game, account: &AccountId) -> Result<String, GameError> {
    Ok(game
        .equipped_skins(account)?
        .get(&SkinCategory::Character)
        .map(|skin| skin.as_str().to_string())
        .unwrap_or_else(|| DEFAULT_HAT.to_string()))
}

fn claim_completed_achievements(
    game: &Game,
    account: &AccountId,
) -> Result<Vec<AchievementToastDto>, GameError> {
    let mut claimed = Vec::new();
    for view in game.achievements_for(account)? {
        if !view.completed || view.claimed {
            continue;
        }
        let reward = game.achievement(&view.id)?.reward.clone();
        match game.claim_achievement(account, &view.id) {
            Ok(_) => claimed.push(AchievementToastDto {
                name: view.name,
                coins: coin_reward(&reward),
            }),
            Err(GameError::AchievementAlreadyClaimed) => {}
            Err(error) => return Err(error),
        }
    }
    Ok(claimed)
}

fn coin_reward(reward: &Reward) -> u64 {
    reward
        .currencies
        .iter()
        .find(|grant| grant.currency.as_str() == COIN)
        .map(|grant| grant.amount)
        .unwrap_or(0)
}

fn coin_cost(cost: &Cost) -> u64 {
    cost.currencies
        .iter()
        .find(|grant| grant.currency.as_str() == COIN)
        .map(|grant| grant.amount)
        .unwrap_or(0)
}

fn ensure_near(
    player: [f64; 3],
    target: [f64; 3],
    max_angle: f64,
    message: &str,
) -> Result<(), ApiError> {
    let dot =
        (player[0] * target[0] + player[1] * target[1] + player[2] * target[2]).clamp(-1.0, 1.0);
    if dot.acos() > max_angle {
        return Err(ApiError::bad("TOO_FAR", format!("{message}。")));
    }
    Ok(())
}

fn normalize_dir(dir: [f64; 3]) -> Result<[f64; 3], ApiError> {
    if !dir.iter().all(|value| value.is_finite()) {
        return Err(ApiError::bad("BAD_POSITION", "位置数据不正确。"));
    }
    let length = (dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]).sqrt();
    if length < 0.1 {
        return Err(ApiError::bad("BAD_POSITION", "还没有出生在星球上。"));
    }
    Ok(normalize(dir))
}

fn update_presence_dir(
    state: &AppState,
    account: &AccountId,
    dir: [f64; 3],
    heading: f64,
    game: &Game,
) -> Result<(), ApiError> {
    let record = game.account(account)?;
    let hat = current_hat(game, account)?;
    let now = now_ms();
    let mut presence = state.presence.lock().expect("presence lock");
    let entry = presence
        .entry(account.as_str().to_string())
        .or_insert_with(|| Presence {
            name: record.display_name.clone(),
            level: record.level,
            dir,
            heading,
            hat: hat.clone(),
            emote: None,
            last_seen_ms: now,
        });
    entry.dir = dir;
    entry.heading = heading;
    entry.hat = hat;
    entry.name = record.display_name;
    entry.level = record.level;
    entry.last_seen_ms = now;
    Ok(())
}

fn online_count(state: &AppState) -> usize {
    let now = now_ms();
    state
        .presence
        .lock()
        .expect("presence lock")
        .values()
        .filter(|entry| now - entry.last_seen_ms < 15_000)
        .count()
}

pub fn persist(state: &AppState) {
    if let Err(error) = state.game.save_to(state.store.as_ref()) {
        tracing::error!(?error, "failed to persist game snapshot");
    }
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

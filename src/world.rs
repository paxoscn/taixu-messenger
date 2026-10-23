//! The tiny planet's fixed geography, residents, and the taixu catalog that
//! backs all progression.

use serde::Serialize;
use taixu::prelude::*;

pub const REGION_ID: &str = "tiny-planet";
pub const PLANET_RADIUS: f64 = 30.0;
pub const COIN: &str = "coins";
pub const DELIVERY_BOARD: &str = "delivery_guild";
pub const HAT_SHOP: &str = "hat_shop";
pub const STAMP_ALBUM: &str = "stamp_album";
pub const DEFAULT_HAT: &str = "hat_postman";

#[derive(Clone, Copy)]
pub struct PlaceSpec {
    pub id: &'static str,
    pub name: &'static str,
    pub kind: &'static str,
    pub lat: f64,
    pub lon: f64,
}

#[derive(Clone, Copy)]
pub struct NpcSpec {
    pub id: &'static str,
    pub name: &'static str,
    pub title: &'static str,
    pub place: &'static str,
    pub lat: f64,
    pub lon: f64,
    pub body: &'static str,
    pub accent: &'static str,
    pub stamp_name: &'static str,
    pub letter_name: &'static str,
    pub thanks: &'static str,
    pub lines: &'static [&'static str],
    /// Poppy hands out the letters; everyone else receives them.
    pub receives_mail: bool,
}

pub const PLACES: &[PlaceSpec] = &[
    PlaceSpec {
        id: "post",
        name: "微光邮局",
        kind: "post",
        lat: 6.0,
        lon: 0.0,
    },
    PlaceSpec {
        id: "windmill",
        name: "风车磨坊",
        kind: "windmill",
        lat: 26.0,
        lon: 52.0,
    },
    PlaceSpec {
        id: "lighthouse",
        name: "潮汐灯塔",
        kind: "lighthouse",
        lat: -8.0,
        lon: 104.0,
    },
    PlaceSpec {
        id: "beach",
        name: "贝壳海滩",
        kind: "beach",
        lat: -30.0,
        lon: 158.0,
    },
    PlaceSpec {
        id: "temple",
        name: "云顶小寺",
        kind: "temple",
        lat: 36.0,
        lon: 210.0,
    },
    PlaceSpec {
        id: "station",
        name: "环星车站",
        kind: "station",
        lat: -14.0,
        lon: 262.0,
    },
    PlaceSpec {
        id: "forest",
        name: "低语森林",
        kind: "forest",
        lat: 16.0,
        lon: 314.0,
    },
];

pub const NPCS: &[NpcSpec] = &[
    NpcSpec {
        id: "poppy",
        name: "波比",
        title: "邮局局长",
        place: "post",
        lat: 4.0,
        lon: 2.2,
        body: "#e98a72",
        accent: "#fff3d6",
        stamp_name: "",
        letter_name: "",
        thanks: "",
        lines: &[
            "风从星球另一边吹过来，今天的信也带着海盐味。",
            "把信送到就好，不用着急。小星球会等你。",
            "集齐六张居民邮票，就能在集邮册里换到一顶星星王冠。",
        ],
        receives_mail: false,
    },
    NpcSpec {
        id: "ada",
        name: "阿达",
        title: "灯塔守夜人",
        place: "lighthouse",
        lat: -6.0,
        lon: 106.0,
        body: "#6f95d8",
        accent: "#f6e7b4",
        stamp_name: "灯塔邮票",
        letter_name: "写给阿达的信",
        thanks: "阿达把信贴在胸口：谢谢你，今晚的灯会更亮一点。",
        lines: &[
            "夜里我把灯点上，迷路的云就会找到回家的路。",
            "海面每天都会换一种蓝色，只有信笺的颜色一直不变。",
            "你听，风穿过灯罩的时候，像一封没有写完的信。",
        ],
        receives_mail: true,
    },
    NpcSpec {
        id: "milo",
        name: "米洛",
        title: "风车面包师",
        place: "windmill",
        lat: 28.0,
        lon: 50.0,
        body: "#d7a45f",
        accent: "#fff0c9",
        stamp_name: "麦香邮票",
        letter_name: "写给米洛的信",
        thanks: "米洛晃了晃面粉袋：正好，配信里的故事烤一炉面包。",
        lines: &[
            "面粉、黄油，还有一封远方来的信——今天真不错。",
            "风车转一圈，我就揉一次面。星球转一圈，面包就醒好了。",
            "要是迷路了，就跟着麦子的香味走。",
        ],
        receives_mail: true,
    },
    NpcSpec {
        id: "nia",
        name: "妮娅",
        title: "贝壳收藏家",
        place: "beach",
        lat: -32.0,
        lon: 160.0,
        body: "#5fc6b6",
        accent: "#ffe6ce",
        stamp_name: "贝壳邮票",
        letter_name: "写给妮娅的信",
        thanks: "妮娅把信举到耳边：里面有潮声，我听见了。",
        lines: &[
            "我把贝壳排成一圈，它们说今天会有邮差经过。",
            "这枚螺旋贝壳来自星球背面，你信吗？",
            "别踩到那串小脚印，是寄居蟹在散步。",
        ],
        receives_mail: true,
    },
    NpcSpec {
        id: "tom",
        name: "汤姆",
        title: "山寺住持",
        place: "temple",
        lat: 38.0,
        lon: 208.0,
        body: "#b78cd8",
        accent: "#f3e8ff",
        stamp_name: "山岚邮票",
        letter_name: "写给汤姆的信",
        thanks: "汤姆把信放进香炉旁的木匣：慢慢来，山会记得。",
        lines: &[
            "山不高，但能看见整颗星球在慢慢转。",
            "今天敲了三下钟。第一下给风，第二下给海，第三下给还没到的信。",
            "坐在台阶上歇会儿吧，云会替你赶路。",
        ],
        receives_mail: true,
    },
    NpcSpec {
        id: "ruby",
        name: "露比",
        title: "环星车站站长",
        place: "station",
        lat: -12.0,
        lon: 260.0,
        body: "#e3b94f",
        accent: "#3b4664",
        stamp_name: "汽笛邮票",
        letter_name: "写给露比的信",
        thanks: "露比吹了一声口哨：本次列车，准点抵达！",
        lines: &[
            "下一班车是……唔，星球上没有车站，我摆着玩的。",
            "站牌每七天换一个方向，可从来没人坐错车。",
            "汽笛响三声，就是有信从远方来。",
        ],
        receives_mail: true,
    },
    NpcSpec {
        id: "pip",
        name: "皮普",
        title: "林地画家",
        place: "forest",
        lat: 18.0,
        lon: 316.0,
        body: "#91c46c",
        accent: "#fff6d9",
        stamp_name: "森林邮票",
        letter_name: "写给皮普的信",
        thanks: "皮普把信别在画架上：这封信的颜色，正好是春天。",
        lines: &[
            "我在画一棵会走路的树。它刚刚又挪了半步。",
            "森林里的影子比树叶多，多出来的那部分会讲故事。",
            "帮我看着颜料盒，别让松鼠把蓝色叼走。",
        ],
        receives_mail: true,
    },
];

pub const EMOTES: &[&str] = &["wave", "heart", "laugh", "note", "mail", "star"];

pub fn latlon(lat_deg: f64, lon_deg: f64) -> [f64; 3] {
    let lat = lat_deg.to_radians();
    let lon = lon_deg.to_radians();
    let x = lat.cos() * lon.sin();
    let y = lat.sin();
    let z = lat.cos() * lon.cos();
    normalize([x, y, z])
}

pub fn normalize(v: [f64; 3]) -> [f64; 3] {
    let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if len <= f64::EPSILON {
        return [0.0, 1.0, 0.0];
    }
    [v[0] / len, v[1] / len, v[2] / len]
}

pub fn npc_by_id(id: &str) -> Option<&'static NpcSpec> {
    NPCS.iter().find(|npc| npc.id == id)
}

pub fn place_by_id(id: &str) -> Option<&'static PlaceSpec> {
    PLACES.iter().find(|place| place.id == id)
}

pub fn npc_dir(npc: &NpcSpec) -> [f64; 3] {
    latlon(npc.lat, npc.lon)
}

pub fn place_dir(place: &PlaceSpec) -> [f64; 3] {
    latlon(place.lat, place.lon)
}

pub fn start_dir() -> [f64; 3] {
    latlon(-2.0, -9.0)
}

pub fn post_dir() -> [f64; 3] {
    latlon(6.0, 0.0)
}

pub fn letter_item(npc_id: &str) -> String {
    format!("letter_{npc_id}")
}

pub fn stamp_item(npc_id: &str) -> String {
    format!("stamp_{npc_id}")
}

pub fn letter_targets() -> impl Iterator<Item = &'static NpcSpec> {
    NPCS.iter().filter(|npc| npc.receives_mail)
}

pub fn letter_from_item(item_id: &str) -> Option<&'static NpcSpec> {
    item_id
        .strip_prefix("letter_")
        .and_then(|id| NPCS.iter().find(|npc| npc.receives_mail && npc.id == id))
}

pub fn hat_label(skin_id: &str) -> &'static str {
    match skin_id {
        "hat_postman" => "邮差帽",
        "hat_straw" => "麦秆草帽",
        "hat_flower" => "小花环",
        "hat_sailor" => "水手帽",
        "hat_crown" => "星星王冠",
        _ => "帽子",
    }
}

pub fn task_metric_label(metric: &str) -> &'static str {
    match metric {
        "delivery" => "完成投递",
        "meet" => "拜访居民",
        "stamp" => "收集邮票",
        _ => "进度",
    }
}

// ---------------------------------------------------------------------------
// Wire types shared with the browser
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize)]
pub struct PlaceDto {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub dir: [f64; 3],
}

#[derive(Clone, Serialize)]
pub struct NpcDto {
    pub id: String,
    pub name: String,
    pub title: String,
    pub place: String,
    pub dir: [f64; 3],
    pub body: String,
    pub accent: String,
    pub receives_mail: bool,
}

#[derive(Clone, Serialize)]
pub struct WorldDto {
    pub radius: f64,
    pub start_dir: [f64; 3],
    pub places: Vec<PlaceDto>,
    pub npcs: Vec<NpcDto>,
    pub emotes: Vec<String>,
}

pub fn world_dto() -> WorldDto {
    WorldDto {
        radius: PLANET_RADIUS,
        start_dir: start_dir(),
        places: PLACES
            .iter()
            .map(|place| PlaceDto {
                id: place.id.into(),
                name: place.name.into(),
                kind: place.kind.into(),
                dir: place_dir(place),
            })
            .collect(),
        npcs: NPCS
            .iter()
            .map(|npc| NpcDto {
                id: npc.id.into(),
                name: npc.name.into(),
                title: npc.title.into(),
                place: npc.place.into(),
                dir: npc_dir(npc),
                body: npc.body.into(),
                accent: npc.accent.into(),
                receives_mail: npc.receives_mail,
            })
            .collect(),
        emotes: EMOTES.iter().map(|value| value.to_string()).collect(),
    }
}

// ---------------------------------------------------------------------------
// Catalog seeding
// ---------------------------------------------------------------------------

pub fn seed_catalog(game: &Game) -> taixu::Result<()> {
    game.create_region(REGION_ID, "微光星球", Some(10_000), None)?;

    for npc in NPCS {
        if npc.receives_mail {
            game.register_item(
                ItemDef::new(letter_item(npc.id), npc.letter_name)
                    .with_description(format!("送去{}。靠近收信人按 E 投递。", npc.place))
                    .with_stack_limit(1),
            )?;
            game.register_item(
                ItemDef::new(stamp_item(npc.id), npc.stamp_name)
                    .with_description("集邮册里的一枚居民邮票。")
                    .unique(),
            )?;
        }
    }

    for (id, name) in [
        ("hat_postman", "邮差帽"),
        ("hat_straw", "麦秆草帽"),
        ("hat_flower", "小花环"),
        ("hat_sailor", "水手帽"),
        ("hat_crown", "星星王冠"),
    ] {
        game.register_skin(
            SkinDef::new(id, name, SkinCategory::Character)
                .with_description("在小星球上戴一顶自己喜欢的帽子。"),
        )?;
    }

    game.register_task(
        TaskDef::new("first_letter", "第一封信")
            .with_description("在邮局按 E 领取一封信，把它送到居民手中。")
            .with_category("主线")
            .with_objective(TaskObjective::metric("delivery", 1))
            .with_reward(Reward::new().currency(COIN, 60).xp(30)),
    )?;
    game.register_task(
        TaskDef::new("daily_round", "今日邮路")
            .with_description("完成 3 次投递。领取后每天可以再来一轮。")
            .with_category("日常")
            .with_objective(TaskObjective::metric("delivery", 3))
            .with_reward(Reward::new().currency(COIN, 120).xp(40))
            .with_repeat(TaskRepeat::daily()),
    )?;
    game.register_task(
        TaskDef::new("new_faces", "认识大家")
            .with_description("接取后，和 4 位居民聊聊天。靠近居民按 E 交谈。")
            .with_category("探索")
            .with_objective(TaskObjective::metric("meet", 4))
            .with_reward(Reward::new().currency(COIN, 80).xp(30)),
    )?;
    game.register_task(
        TaskDef::new("stamp_hunter", "集邮入门")
            .with_description("接取后，收集 3 张不同的居民邮票。每送一封信会得到一张。")
            .with_category("收藏")
            .with_objective(TaskObjective::metric("stamp", 3))
            .with_reward(Reward::new().currency(COIN, 100).xp(20)),
    )?;

    game.register_achievement(
        AchievementDef::new(
            "first_delivery",
            "初入邮路",
            "delivery",
            1,
            Reward::new().currency(COIN, 25),
        )
        .with_description("送出第一封信。"),
    )?;
    game.register_achievement(
        AchievementDef::new(
            "courier_10",
            "勤快邮差",
            "delivery",
            10,
            Reward::new().currency(COIN, 150),
        )
        .with_description("累计送出 10 封信。"),
    )?;
    game.register_achievement(
        AchievementDef::new(
            "meet_all",
            "星球熟人",
            "meet",
            6,
            Reward::new().currency(COIN, 100),
        )
        .with_description("和六位居民都聊过天。"),
    )?;
    game.register_achievement(
        AchievementDef::new(
            "stamp_master",
            "集邮达人",
            "stamp",
            6,
            Reward::new().currency(COIN, 300),
        )
        .with_description("集齐六张居民邮票。"),
    )?;

    let mut shop = Shop::new(HAT_SHOP, "风铃帽子铺")
        .with_description("用送信赚来的金币，换一顶适合小星球风景的帽子。");
    shop.add_offer(
        ShopOffer::new(
            "straw",
            "麦秆草帽",
            Cost::new().currency(COIN, 80),
            Reward::new().skin("hat_straw"),
        )
        .with_description("米洛的麦田同款，晒起来有阳光的味道。")
        .with_per_account_limit(1),
    )?;
    shop.add_offer(
        ShopOffer::new(
            "flower",
            "小花环",
            Cost::new().currency(COIN, 120),
            Reward::new().skin("hat_flower"),
        )
        .with_description("妮娅用海边小花编的，戴上去像春天。")
        .with_per_account_limit(1),
    )?;
    shop.add_offer(
        ShopOffer::new(
            "sailor",
            "水手帽",
            Cost::new().currency(COIN, 180),
            Reward::new().skin("hat_sailor"),
        )
        .with_description("露比珍藏的旧物，帽檐上还留着海风。")
        .with_per_account_limit(1),
    )?;
    game.register_shop(shop)?;

    let album = CollectionDef::new(STAMP_ALBUM, "居民邮票册")
        .with_description("每送出一封信，就会认识一位新朋友，也会收到一张邮票。")
        .with_entries(letter_targets().map(|npc| Collectible::Item(stamp_item(npc.id).into())))
        .with_milestones([
            CollectionMilestone::new(3, Reward::new().currency(COIN, 100)),
            CollectionMilestone::new(6, Reward::new().currency(COIN, 200).skin("hat_crown")),
        ]);
    game.register_collection(album)?;

    game.register_leaderboard(
        Leaderboard::new(DELIVERY_BOARD, "本周邮差榜", ScoreOrder::HigherIsBetter)
            .with_description("按累计投递信件数排名。")
            .with_max_entries(100),
    )?;

    game.publish_announcement(
        AnnouncementDraft::new(
            "欢迎来到微光星球",
            "这颗小星球只有三十秒那么大。在邮局按 E 领一封信，把它送到某一盏灯下——不用赶时间，沿途的云和风都会等你。",
        )
        .with_kind(AnnouncementKind::News)
        .with_priority(10),
    )?;
    game.publish_announcement(
        AnnouncementDraft::new(
            "集邮小活动",
            "集齐六张居民邮票，可以在集邮册里领取「星星王冠」。听说戴上它，夜里会发光。",
        )
        .with_kind(AnnouncementKind::Event)
        .with_priority(5),
    )?;

    Ok(())
}

// ---------------------------------------------------------------------------
// World tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::store::FileStore;

    fn new_world() -> Game {
        let game = Game::with_config(GameConfig::default());
        seed_catalog(&game).expect("the tiny planet should seed cleanly");
        game
    }

    #[test]
    fn catalog_contains_the_whole_planet() {
        let game = new_world();
        assert_eq!(game.regions().len(), 1);
        assert!(game.items().len() >= 12);
        assert!(game.skins().len() >= 5);
        assert!(game.collections().len() == 1);
        assert!(game.announcements().len() >= 2);
        assert!(game.leaderboard(&DELIVERY_BOARD.into()).is_ok());
        assert!(game.shop(&HAT_SHOP.into()).is_ok());
        assert!(
            game.task_definitions()
                .iter()
                .any(|task| task.id.as_str() == "first_letter")
        );

        let dto = world_dto();
        assert_eq!(dto.npcs.len(), NPCS.len());
        assert_eq!(dto.places.len(), PLACES.len());
        assert!(letter_targets().count() == NPCS.iter().filter(|npc| npc.receives_mail).count());

        for direction in [
            start_dir(),
            post_dir(),
            npc_dir(&NPCS[1]),
            place_dir(&PLACES[2]),
        ] {
            let length = (direction[0] * direction[0]
                + direction[1] * direction[1]
                + direction[2] * direction[2])
                .sqrt();
            assert!((length - 1.0).abs() < 1e-9);
        }
    }

    #[test]
    fn delivery_progression_is_claimable() -> taixu::Result<()> {
        let game = new_world();
        let alice = game.ensure_account("test-alice", "Alice", REGION_ID)?;
        let coin: CurrencyId = COIN.into();
        let coins_before = game.currency_balance(&alice.id, &coin)?;

        let task: TaskId = "first_letter".into();
        game.accept_task(&alice.id, &task)?;
        let letter: ItemId = letter_item("ada").into();
        game.add_item(&alice.id, &letter, 1)?;
        game.remove_item(&alice.id, &letter, 1)?;
        game.grant_reward(&alice.id, &Reward::new().currency(COIN, 35).xp(15))?;
        let stamp: ItemId = stamp_item("ada").into();
        game.add_item(&alice.id, &stamp, 1)?;
        game.record_event(&alice.id, "stamp", 1)?;
        game.record_event(&alice.id, "delivery", 1)?;

        assert_eq!(game.item_count(&alice.id, &stamp)?, 1);
        assert_eq!(game.currency_balance(&alice.id, &coin)?, coins_before + 35);
        assert_eq!(
            game.task_view(&alice.id, &task)?.status,
            TaskStatus::Completed
        );

        let achievement = game
            .achievements_for(&alice.id)?
            .into_iter()
            .find(|view| view.id.as_str() == "first_delivery")
            .expect("first delivery achievement");
        assert!(achievement.completed);
        game.claim_achievement(&alice.id, &achievement.id)?;

        game.claim_task(&alice.id, &task)?;
        assert_eq!(
            game.task_view(&alice.id, &task)?.status,
            TaskStatus::Claimed
        );
        Ok(())
    }

    #[test]
    fn shop_and_stamp_album_rewards_are_atomic() -> taixu::Result<()> {
        let game = new_world();
        let alice = game.ensure_account("test-bob", "Bob", REGION_ID)?;
        let shop: ShopId = HAT_SHOP.into();
        let straw: OfferId = "straw".into();

        let failure = game.purchase(&alice.id, &shop, &straw, 1);
        assert!(matches!(failure, Err(GameError::InsufficientFunds { .. })));
        assert!(!game.owns_skin(&alice.id, &"hat_straw".into())?);

        game.add_currency(&alice.id, &COIN.into(), 1_000)?;
        game.purchase(&alice.id, &shop, &straw, 1)?;
        assert!(game.owns_skin(&alice.id, &"hat_straw".into())?);

        for npc in letter_targets() {
            let stamp: ItemId = stamp_item(npc.id).into();
            game.add_item(&alice.id, &stamp, 1)?;
        }
        let album: CollectionId = STAMP_ALBUM.into();
        let progress = game.collection_progress(&alice.id, &album)?;
        assert_eq!(progress.collected, 6);
        assert_eq!(progress.total, 6);
        assert!(
            progress
                .milestones
                .iter()
                .all(|milestone| milestone.unlocked)
        );

        game.claim_collection_milestone(&alice.id, &album, 0)?;
        let crown = game.claim_collection_milestone(&alice.id, &album, 1)?;
        assert!(crown.skins.iter().any(|skin| skin.as_str() == "hat_crown"));
        assert!(game.owns_skin(&alice.id, &"hat_crown".into())?);
        assert!(matches!(
            game.claim_collection_milestone(&alice.id, &album, 1),
            Err(GameError::AlreadyClaimed)
        ));
        Ok(())
    }

    #[test]
    fn snapshot_roundtrip_keeps_progress() -> taixu::Result<()> {
        let game = new_world();
        let alice = game.ensure_account("test-cara", "Cara", REGION_ID)?;
        let coin: CurrencyId = COIN.into();
        game.add_currency(&alice.id, &coin, 321)?;
        game.record_event(&alice.id, "delivery", 2)?;
        game.set_leaderboard_score(&DELIVERY_BOARD.into(), &alice.id, 2)?;
        game.grant_skin(&alice.id, &"hat_sailor".into())?;

        let json = serde_json::to_string(&game.snapshot()).unwrap();
        let decoded: GameState = serde_json::from_str(&json).unwrap();
        let restored = Game::from_state(decoded, game.config().clone(), Arc::new(SystemClock));
        assert_eq!(restored.account(&alice.id)?.display_name, "Cara");
        assert_eq!(restored.currency_balance(&alice.id, &coin)?, 321);
        assert!(restored.owns_skin(&alice.id, &"hat_sailor".into())?);
        assert_eq!(
            restored.leaderboard_score(&DELIVERY_BOARD.into(), &alice.id)?,
            Some(2)
        );
        Ok(())
    }

    #[test]
    fn file_store_saves_and_loads_the_snapshot() -> taixu::Result<()> {
        use taixu::store::GameStore;

        let game = new_world();
        let alice = game.ensure_account("test-dana", "Dana", REGION_ID)?;
        let path = std::env::temp_dir().join(format!(
            "taixu-messenger-test-{}-{}.json",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let store = FileStore::new(&path);
        game.save_to(&store).unwrap();
        let snapshot = store.load().unwrap().expect("a saved snapshot");
        let restored = Game::from_state(snapshot, game.config().clone(), Arc::new(SystemClock));
        assert!(restored.account(&alice.id).is_ok());
        std::fs::remove_file(&path).ok();
        Ok(())
    }
}

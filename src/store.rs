//! A tiny atomic JSON file store for the taixu snapshot.

use std::fs;
use std::io;
use std::path::PathBuf;

use taixu::prelude::*;
use taixu::store::{GameStore, StoreError};

pub struct FileStore {
    path: PathBuf,
}

impl FileStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }
}

impl GameStore for FileStore {
    fn load(&self) -> Result<Option<GameState>, StoreError> {
        match fs::read(&self.path) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(|error| StoreError::new(error.to_string())),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(StoreError::new(error.to_string())),
        }
    }

    fn save(&self, state: &GameState) -> Result<(), StoreError> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| StoreError::new(error.to_string()))?;
        }
        let bytes =
            serde_json::to_vec(state).map_err(|error| StoreError::new(error.to_string()))?;
        let temporary = self.path.with_extension("json.tmp");
        fs::write(&temporary, bytes).map_err(|error| StoreError::new(error.to_string()))?;
        fs::rename(&temporary, &self.path).map_err(|error| StoreError::new(error.to_string()))?;
        Ok(())
    }
}

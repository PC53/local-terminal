use dashmap::DashMap;
use serde_json::Value;
use std::time::{Duration, Instant};

pub struct Cache {
    store: DashMap<String, (Value, Instant)>,
}

impl Cache {
    pub fn new() -> Self {
        Self { store: DashMap::new() }
    }

    pub fn get(&self, key: &str, ttl_secs: u64) -> Option<Value> {
        self.store.get(key).and_then(|e| {
            if e.1.elapsed() < Duration::from_secs(ttl_secs) {
                Some(e.0.clone())
            } else {
                None
            }
        })
    }

    pub fn set(&self, key: String, val: Value) {
        self.store.insert(key, (val, Instant::now()));
    }
}

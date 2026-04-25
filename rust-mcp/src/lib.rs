// Allow clippy warnings that are acceptable for this codebase
#![allow(clippy::too_many_arguments)]
#![allow(clippy::result_large_err)]

pub mod cleanup;
pub mod config_manager;
pub mod mcp;
pub mod odoo;

#[cfg(test)]
pub static TEST_ENV_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

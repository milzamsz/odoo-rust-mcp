use std::sync::Arc;

use futures::StreamExt;
use tokio::sync::RwLock;

use mcp_rust_sdk::error::{Error, ErrorCode};
use mcp_rust_sdk::protocol::{Request, Response, ResponseError};
use mcp_rust_sdk::transport::{Message, Transport};
use mcp_rust_sdk::types::{ClientCapabilities, Implementation};
use mcp_rust_sdk::server::ServerHandler;

pub struct ServerCompat {
    transport: Arc<dyn Transport>,
    handler: Arc<dyn ServerHandler>,
    initialized: Arc<RwLock<bool>>,
}

impl ServerCompat {
    pub fn new(transport: Arc<dyn Transport>, handler: Arc<dyn ServerHandler>) -> Self {
        Self {
            transport,
            handler,
            initialized: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn start(&self) -> Result<(), Error> {
        let mut stream = self.transport.receive();
        while let Some(message) = stream.next().await {
            match message? {
                Message::Request(request) => {
                    let response = match self.handle_request(request.clone()).await {
                        Ok(resp) => resp,
                        Err(err) => Response::error(request.id, ResponseError::from(err)),
                    };
                    self.transport.send(Message::Response(response)).await?;
                }
                Message::Notification(notification) => {
                    match notification.method.as_str() {
                        "exit" => break,
                        "initialized" => {
                            *self.initialized.write().await = true;
                        }
                        _ => {}
                    }
                }
                Message::Response(_) => {
                    return Err(Error::protocol(
                        ErrorCode::InvalidRequest,
                        "Server received unexpected response",
                    ));
                }
            }
        }
        Ok(())
    }

    async fn handle_request(&self, request: Request) -> Result<Response, Error> {
        let initialized = *self.initialized.read().await;

        match request.method.as_str() {
            "initialize" => {
                if initialized {
                    return Err(Error::protocol(
                        ErrorCode::InvalidRequest,
                        "Server already initialized",
                    ));
                }

                let params = request.params.unwrap_or(serde_json::json!({}));

                // Accept both MCP-spec-ish and mcp_rust_sdk legacy field names.
                let impl_val = params
                    .get("implementation")
                    .cloned()
                    .or_else(|| params.get("client_info").cloned())
                    .or_else(|| params.get("clientInfo").cloned())
                    .unwrap_or_default();

                let caps_val = params.get("capabilities").cloned().unwrap_or_default();

                let implementation: Implementation = serde_json::from_value(impl_val)?;
                let capabilities: ClientCapabilities = serde_json::from_value(caps_val)?;

                let result = self.handler.initialize(implementation, capabilities).await?;
                Ok(Response::success(request.id, Some(serde_json::to_value(result)?)))
            }
            "shutdown" => {
                if !initialized {
                    return Err(Error::protocol(
                        ErrorCode::ServerNotInitialized,
                        "Server not initialized",
                    ));
                }
                self.handler.shutdown().await?;
                Ok(Response::success(request.id, None))
            }
            _ => {
                if !initialized {
                    return Err(Error::protocol(
                        ErrorCode::ServerNotInitialized,
                        "Server not initialized",
                    ));
                }
                let result = self.handler.handle_method(&request.method, request.params).await?;
                Ok(Response::success(request.id, Some(result)))
            }
        }
    }
}


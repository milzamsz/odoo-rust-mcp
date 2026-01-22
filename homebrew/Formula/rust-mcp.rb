class RustMcp < Formula
  desc "Odoo MCP Server - Model Context Protocol server for Odoo integration"
  homepage "https://github.com/rachmataditiya/odoo-rust-mcp"
  version "0.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v#{version}/rust-mcp-aarch64-apple-darwin.tar.gz"
      sha256 "PLACEHOLDER_SHA256_MACOS_ARM64"
    end

    if Hardware::CPU.intel?
      url "https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v#{version}/rust-mcp-x86_64-apple-darwin.tar.gz"
      sha256 "PLACEHOLDER_SHA256_MACOS_X64"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/rachmataditiya/odoo-rust-mcp/releases/download/v#{version}/rust-mcp-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "PLACEHOLDER_SHA256_LINUX_X64"
    end
  end

  def install
    bin.install "rust-mcp"
    # Install config files to share directory (defaults)
    (share/"odoo-rust-mcp").install Dir["config/*"] if Dir.exist?("config")
    # Install example env file
    (share/"odoo-rust-mcp").install ".env.example" if File.exist?(".env.example")

    # Create wrapper script that loads env file before running
    (bin/"rust-mcp-service").write <<~EOS
      #!/bin/bash
      # Load environment from user config if exists
      if [ -f "$HOME/.config/odoo-rust-mcp/env" ]; then
        set -a
        source "$HOME/.config/odoo-rust-mcp/env"
        set +a
      fi
      exec "#{opt_bin}/rust-mcp" "$@"
    EOS
    chmod 0755, bin/"rust-mcp-service"
  end

  def post_install
    # Create user config directory
    user_config_dir = Pathname.new(Dir.home)/".config/odoo-rust-mcp"
    user_config_dir.mkpath unless user_config_dir.exist?

    # Copy default env file if not exists
    user_env_file = user_config_dir/"env"
    unless user_env_file.exist?
      user_env_file.write <<~EOS
        # Odoo Rust MCP Server Configuration
        # Edit this file with your Odoo credentials

        # =============================================================================
        # Odoo 19+ (JSON-2 API with API Key)
        # =============================================================================
        ODOO_URL=http://localhost:8069
        ODOO_DB=mydb
        ODOO_API_KEY=YOUR_API_KEY

        # =============================================================================
        # Odoo < 19 (JSON-RPC with Username/Password)
        # Uncomment and set ODOO_VERSION to enable legacy mode
        # =============================================================================
        # ODOO_URL=http://localhost:8069
        # ODOO_DB=mydb
        # ODOO_VERSION=18
        # ODOO_USERNAME=admin
        # ODOO_PASSWORD=admin

        # =============================================================================
        # MCP Authentication (HTTP transport only)
        # =============================================================================
        # Generate a secure token: openssl rand -hex 32
        # MCP_AUTH_TOKEN=your-secure-random-token-here

        # =============================================================================
        # MCP Config paths (auto-configured by Homebrew)
        # =============================================================================
        MCP_TOOLS_JSON=#{HOMEBREW_PREFIX}/share/odoo-rust-mcp/tools.json
        MCP_PROMPTS_JSON=#{HOMEBREW_PREFIX}/share/odoo-rust-mcp/prompts.json
        MCP_SERVER_JSON=#{HOMEBREW_PREFIX}/share/odoo-rust-mcp/server.json
      EOS
      chmod 0600, user_env_file
    end

    # Copy default config files if not exist
    %w[tools.json prompts.json server.json].each do |config_file|
      user_config = user_config_dir/config_file
      default_config = share/"odoo-rust-mcp"/config_file
      if !user_config.exist? && default_config.exist?
        cp default_config, user_config
      end
    end

    ohai "Configuration files created in ~/.config/odoo-rust-mcp/"
    ohai "Edit ~/.config/odoo-rust-mcp/env with your Odoo credentials"
  end

  # Service configuration for `brew services start rust-mcp`
  service do
    run [opt_bin/"rust-mcp-service", "--transport", "http", "--listen", "127.0.0.1:8787"]
    keep_alive true
    log_path var/"log/rust-mcp.log"
    error_log_path var/"log/rust-mcp.log"
  end

  def caveats
    <<~EOS
      Configuration files created in: ~/.config/odoo-rust-mcp/
        - env           (environment variables - EDIT THIS with your Odoo credentials)
        - tools.json    (MCP tools definition)
        - prompts.json  (MCP prompts definition)
        - server.json   (MCP server metadata)

      Default config templates: #{share}/odoo-rust-mcp/

      Usage:
        Run directly (stdio):  rust-mcp --transport stdio
        Run as HTTP server:    rust-mcp --transport http --listen 127.0.0.1:8787

      Run as a background service:
        1. Edit ~/.config/odoo-rust-mcp/env with your Odoo credentials
        2. brew services start rust-mcp

      Service commands:
        brew services start rust-mcp
        brew services stop rust-mcp
        brew services restart rust-mcp

      Service endpoint: http://127.0.0.1:8787/mcp
      Service logs: #{var}/log/rust-mcp.log

      For Cursor IDE configuration:
        See: https://github.com/rachmataditiya/odoo-rust-mcp#readme
    EOS
  end

  test do
    assert_match "rust-mcp", shell_output("#{bin}/rust-mcp --help")
  end
end

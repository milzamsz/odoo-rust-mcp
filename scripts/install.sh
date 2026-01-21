#!/bin/bash
set -e

# Odoo Rust MCP Server Installer
# Installs to /usr/local/bin (binary) and /usr/local/share/odoo-rust-mcp (config)

REPO="rachmataditiya/odoo-rust-mcp"
BINARY_NAME="rust-mcp"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/usr/local/share/odoo-rust-mcp"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Detect OS and architecture
detect_platform() {
    local os arch

    case "$(uname -s)" in
        Linux*)  os="linux" ;;
        Darwin*) os="darwin" ;;
        *)       error "Unsupported OS: $(uname -s)" ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)  arch="x86_64" ;;
        arm64|aarch64) arch="aarch64" ;;
        *)             error "Unsupported architecture: $(uname -m)" ;;
    esac

    # Linux ARM64 not available yet
    if [ "$os" = "linux" ] && [ "$arch" = "aarch64" ]; then
        error "Linux ARM64 builds are not available yet. Please build from source."
    fi

    if [ "$os" = "linux" ]; then
        echo "${arch}-unknown-linux-gnu"
    else
        echo "${arch}-apple-darwin"
    fi
}

# Get latest release version
get_latest_version() {
    curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/'
}

# Download and install
install() {
    local platform version download_url tmp_dir

    info "Detecting platform..."
    platform=$(detect_platform)
    info "Platform: $platform"

    info "Fetching latest release..."
    version=$(get_latest_version)
    if [ -z "$version" ]; then
        error "Could not determine latest version"
    fi
    info "Version: $version"

    download_url="https://github.com/${REPO}/releases/download/${version}/${BINARY_NAME}-${platform}.tar.gz"
    info "Download URL: $download_url"

    tmp_dir=$(mktemp -d)
    trap "rm -rf $tmp_dir" EXIT

    info "Downloading..."
    curl -sL "$download_url" -o "$tmp_dir/release.tar.gz" || error "Download failed"

    info "Extracting..."
    tar -xzf "$tmp_dir/release.tar.gz" -C "$tmp_dir" || error "Extraction failed"

    info "Installing binary to $INSTALL_DIR..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo cp "$tmp_dir/$BINARY_NAME" "$INSTALL_DIR/" || error "Failed to copy binary"
    sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"

    info "Installing config files to $CONFIG_DIR..."
    sudo mkdir -p "$CONFIG_DIR"
    if [ -d "$tmp_dir/config" ]; then
        sudo cp -r "$tmp_dir/config/"* "$CONFIG_DIR/" || warn "Failed to copy config files"
    fi

    if [ -f "$tmp_dir/.env.example" ]; then
        sudo cp "$tmp_dir/.env.example" "$CONFIG_DIR/" || warn "Failed to copy .env.example"
    fi

    info "Installation complete!"
    echo ""
    echo "Binary installed to: $INSTALL_DIR/$BINARY_NAME"
    echo "Config files installed to: $CONFIG_DIR"
    echo ""
    echo "Quick start:"
    echo "  1. Copy and edit the example environment file:"
    echo "     cp $CONFIG_DIR/.env.example ~/.odoo-mcp.env"
    echo "     # Edit ~/.odoo-mcp.env with your Odoo credentials"
    echo ""
    echo "  2. Run the server:"
    echo "     $BINARY_NAME --transport stdio"
    echo ""
    echo "  3. For Cursor, add to ~/.cursor/mcp.json:"
    echo '     {'
    echo '       "mcpServers": {'
    echo '         "odoo-rust-mcp": {'
    echo '           "type": "stdio",'
    echo "           \"command\": \"$INSTALL_DIR/$BINARY_NAME\","
    echo '           "args": ["--transport", "stdio"],'
    echo '           "env": {'
    echo '             "ODOO_URL": "http://localhost:8069",'
    echo '             "ODOO_DB": "mydb",'
    echo '             "ODOO_API_KEY": "YOUR_API_KEY",'
    echo "             \"MCP_TOOLS_JSON\": \"$CONFIG_DIR/tools.json\","
    echo "             \"MCP_PROMPTS_JSON\": \"$CONFIG_DIR/prompts.json\","
    echo "             \"MCP_SERVER_JSON\": \"$CONFIG_DIR/server.json\""
    echo '           }'
    echo '         }'
    echo '       }'
    echo '     }'
}

# Uninstall
uninstall() {
    info "Uninstalling odoo-rust-mcp..."

    if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
        sudo rm -f "$INSTALL_DIR/$BINARY_NAME"
        info "Removed $INSTALL_DIR/$BINARY_NAME"
    fi

    if [ -d "$CONFIG_DIR" ]; then
        read -p "Remove config directory $CONFIG_DIR? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf "$CONFIG_DIR"
            info "Removed $CONFIG_DIR"
        fi
    fi

    info "Uninstall complete!"
}

# Main
case "${1:-install}" in
    install)   install ;;
    uninstall) uninstall ;;
    *)         echo "Usage: $0 [install|uninstall]"; exit 1 ;;
esac

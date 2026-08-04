#!/usr/bin/env bash
# ============================================================================
# TjuaeUI WebUI 一键安装脚本
# ============================================================================
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/liangboqiang/TjuaeUI/main/scripts/install-web.sh | bash
#   # 或指定版本：
#   VERSION=3.0.0 bash install-web.sh
#   # 或安装到自定义目录：
#   INSTALL_DIR=/opt/tjuaeui-web bash install-web.sh
# ============================================================================

set -euo pipefail

# ─── 默认配置 ────────────────────────────────────────────────────────────────
VERSION="${VERSION:-__VERSION__}"
# 注意：CI 会对本文件执行 `sed "s/__VERSION__/<ver>/g"`，把上方占位符替换为
# 类似“1.9.19”的版本号。resolve_version() 通过正则检查字母来识别未替换占位符，
# 因此不要在下方比较表达式中添加字面量占位符。
INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/share/tjuaeui-web}"
BIN_DIR="${BIN_DIR:-${HOME}/.local/bin}"
MIRROR="${MIRROR:-https://github.com/liangboqiang/TjuaeUI/releases/download}"
CREATE_SYMLINK="${CREATE_SYMLINK:-1}"
UPDATE_PATH="${UPDATE_PATH:-1}"

# ─── 颜色定义 ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # 重置颜色

# ─── 辅助函数 ────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[信息]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*" >&2; }
die()     { error "$*"; exit 1; }

banner() {
    echo -e "${CYAN}${BOLD}"
    echo "  ╔══════════════════════════════════════════════╗"
    echo "  ║       TjuaeUI WebUI 安装程序（无 Electron）     ║"
    echo "  ╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# ─── 解析命令行参数 ──────────────────────────────────────────────────────────
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --version)
                VERSION="$2"
                shift 2
                ;;
            --mirror)
                MIRROR="$2"
                shift 2
                ;;
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --no-symlink)
                CREATE_SYMLINK=0
                shift
                ;;
            --no-path)
                UPDATE_PATH=0
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                warn "未知选项：$1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat <<EOF
用法：install-web.sh [选项]

选项：
  --version <版本>          指定安装版本（默认：最新版或 CI 内嵌版本）
  --mirror <地址>           指定镜像地址（默认：GitHub Releases）
  --install-dir <路径>      指定安装目录（默认：~/.local/share/tjuaeui-web）
  --no-symlink              不在 ~/.local/bin 中创建符号链接
  --no-path                 不向 shell 配置文件添加 PATH
  --help                    显示此帮助信息

环境变量：
  VERSION                   要安装的版本（同 --version）
  INSTALL_DIR               安装目录（同 --install-dir）
  MIRROR                    镜像地址（同 --mirror）

示例：
  # 安装最新版本
  curl -fsSL https://raw.githubusercontent.com/liangboqiang/TjuaeUI/main/scripts/install-web.sh | bash

  # 安装指定版本
  VERSION=3.0.0 bash install-web.sh

  # 安装到自定义目录
  INSTALL_DIR=/opt/tjuaeui-web bash install-web.sh

  # 使用本地文件镜像（离线安装）
  MIRROR=file:///path/to/releases bash install-web.sh
EOF
}

# ─── 核心函数 ────────────────────────────────────────────────────────────────
detect_platform_arch() {
    local os_type="$(uname -s)"
    local machine="$(uname -m)"

    # 映射操作系统类型
    case "$os_type" in
        Darwin)
            PLATFORM="darwin"
            ;;
        Linux)
            PLATFORM="linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            PLATFORM="win"
            ;;
        *)
            die "不支持的操作系统：$os_type（仅支持 Darwin、Linux 和 Windows）"
            ;;
    esac

    # 映射处理器架构
    case "$machine" in
        x86_64|amd64)
            ARCH="x86_64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            die "不支持的处理器架构：$machine（仅支持 x86_64/amd64 和 aarch64/arm64）"
            ;;
    esac

    info "检测到平台：${BOLD}${PLATFORM}-${ARCH}${NC}"

    # 生成压缩包文件名
    TARBALL_NAME="tjuaeui-web-${VERSION}-${PLATFORM}-${ARCH}.tar.gz"
    CHECKSUM_NAME="${TARBALL_NAME}.sha256"
}

resolve_version() {
    # 在以下情况下通过 GitHub API 解析版本：
    # - VERSION 明确为“latest”；
    # - VERSION 仍包含 CI 占位符特征（字母或下划线），说明 sed 尚未执行。
    # 正式版本号只包含数字和点，因此 `[a-zA-Z_]` 可以可靠识别占位符。
    # 此处不能写出占位符字面量，因为 CI 的 sed 会替换本文件中的每一处匹配。
    if [[ "$VERSION" == "latest" || "$VERSION" =~ [a-zA-Z_] ]]; then
        info "正在通过 GitHub API 解析最新版本..."

        if command -v curl &>/dev/null; then
            VERSION=$(curl -fsSL "https://api.github.com/repos/liangboqiang/TjuaeUI/releases/latest" \
                | grep '"tag_name"' | head -1 | sed 's/.*"v\([^"]*\)".*/\1/')
        elif command -v wget &>/dev/null; then
            VERSION=$(wget -qO- "https://api.github.com/repos/liangboqiang/TjuaeUI/releases/latest" \
                | grep '"tag_name"' | head -1 | sed 's/.*"v\([^"]*\)".*/\1/')
        else
            die "解析版本需要 curl 或 wget，请先安装其中一个。"
        fi

        if [[ -z "$VERSION" ]]; then
            die "无法解析最新版本，请手动指定：VERSION=3.0.0 bash $0"
        fi

        info "最新版本：${BOLD}v${VERSION}${NC}"
    else
        info "使用指定版本：${BOLD}v${VERSION}${NC}"
    fi

    # VERSION 可能已变化，重新生成压缩包文件名
    TARBALL_NAME="tjuaeui-web-${VERSION}-${PLATFORM}-${ARCH}.tar.gz"
    CHECKSUM_NAME="${TARBALL_NAME}.sha256"
}

download_tarball() {
    # 创建临时目录
    TEMP_DIR="$(mktemp -d)"
    TARBALL_PATH="${TEMP_DIR}/${TARBALL_NAME}"
    CHECKSUM_PATH="${TEMP_DIR}/${CHECKSUM_NAME}"

    # 生成下载地址
    # MIRROR 格式：
    #   - GitHub: https://github.com/liangboqiang/TjuaeUI/releases/download
    #   - file: file:///path/to/releases
    if [[ "$MIRROR" == file://* ]]; then
        # 本地文件镜像，用于离线安装或测试
        local base_path="${MIRROR#file://}"
        TARBALL_URL="file://${base_path}/v${VERSION}/${TARBALL_NAME}"
        CHECKSUM_URL="file://${base_path}/v${VERSION}/${CHECKSUM_NAME}"
    else
        # GitHub Releases
        TARBALL_URL="${MIRROR}/v${VERSION}/${TARBALL_NAME}"
        CHECKSUM_URL="${MIRROR}/v${VERSION}/${CHECKSUM_NAME}"
    fi

    info "正在下载 ${BOLD}${TARBALL_NAME}${NC}..."
    info "地址：$TARBALL_URL"

    # 下载压缩包
    if [[ "$TARBALL_URL" == file://* ]]; then
        # 本地文件：直接复制
        local src_path="${TARBALL_URL#file://}"
        if [[ ! -f "$src_path" ]]; then
            die "本地镜像中未找到压缩包：$src_path"
        fi
        cp "$src_path" "$TARBALL_PATH"
    else
        # 远程文件：使用 curl 或 wget
        if command -v curl &>/dev/null; then
            curl -fSL --progress-bar -o "$TARBALL_PATH" "$TARBALL_URL" || die "下载失败"
        elif command -v wget &>/dev/null; then
            wget --show-progress -q -O "$TARBALL_PATH" "$TARBALL_URL" || die "下载失败"
        else
            die "下载需要 curl 或 wget，请先安装其中一个。"
        fi
    fi

    local size
    size=$(du -h "$TARBALL_PATH" | cut -f1)
    success "压缩包下载完成（$size）"

    # 下载 SHA256 校验文件
    info "正在下载 ${BOLD}${CHECKSUM_NAME}${NC}..."
    if [[ "$CHECKSUM_URL" == file://* ]]; then
        local src_path="${CHECKSUM_URL#file://}"
        if [[ ! -f "$src_path" ]]; then
            die "本地镜像中未找到校验文件：$src_path"
        fi
        cp "$src_path" "$CHECKSUM_PATH"
    else
        if command -v curl &>/dev/null; then
            curl -fSL -o "$CHECKSUM_PATH" "$CHECKSUM_URL" || die "校验文件下载失败"
        elif command -v wget &>/dev/null; then
            wget -q -O "$CHECKSUM_PATH" "$CHECKSUM_URL" || die "校验文件下载失败"
        fi
    fi

    success "校验文件下载完成"
}

verify_checksum() {
    info "正在验证 SHA256 校验和..."

    # 从 .sha256 文件读取预期校验和
    local expected_checksum
    expected_checksum=$(awk '{print $1}' "$CHECKSUM_PATH")

    if [[ -z "$expected_checksum" ]]; then
        die "无法从 $CHECKSUM_NAME 读取校验和"
    fi

    # 计算实际校验和
    local actual_checksum
    if command -v shasum &>/dev/null; then
        actual_checksum=$(shasum -a 256 "$TARBALL_PATH" | awk '{print $1}')
    elif command -v sha256sum &>/dev/null; then
        actual_checksum=$(sha256sum "$TARBALL_PATH" | awk '{print $1}')
    else
        warn "未找到 shasum 或 sha256sum，跳过校验和验证"
        return
    fi

    if [[ "$actual_checksum" != "$expected_checksum" ]]; then
        error "校验和不匹配！"
        error "预期值：$expected_checksum"
        error "实际值：$actual_checksum"
        die "压缩包可能已损坏，请重试。"
    fi

    success "校验和验证通过：${expected_checksum:0:16}..."
}

extract_tarball() {
    info "正在安装到 ${BOLD}${INSTALL_DIR}${NC}..."

    # 安装目录已存在时备份旧版本
    if [[ -d "$INSTALL_DIR" ]]; then
        local backup_dir="${INSTALL_DIR}.backup.$(date +%s)"
        warn "安装目录已存在，正在创建备份：$backup_dir"
        mv "$INSTALL_DIR" "$backup_dir"
    fi

    # 创建安装目录的父目录
    mkdir -p "$(dirname "$INSTALL_DIR")"

    # 解压压缩包；根目录应为 tjuaeui-web/，解压后移动到 INSTALL_DIR
    local extract_temp="${TEMP_DIR}/extract"
    mkdir -p "$extract_temp"

    info "正在解压..."
    tar -xzf "$TARBALL_PATH" -C "$extract_temp" || die "解压失败"

    # 移动到最终安装位置
    if [[ -d "${extract_temp}/tjuaeui-web" ]]; then
        mv "${extract_temp}/tjuaeui-web" "$INSTALL_DIR"
    else
        die "压缩包结构无效：缺少 tjuaeui-web/ 目录"
    fi

    success "已解压到 $INSTALL_DIR"

    # 为 bun 编译的独立二进制设置可执行权限
    chmod +x "${INSTALL_DIR}/tjuaeui-web" 2>/dev/null || true

    # macOS 下载文件会继承 quarantine 扩展属性；tarball 安装时统一清理。
    if command -v xattr &>/dev/null; then
        xattr -dr com.apple.quarantine "${INSTALL_DIR}" 2>/dev/null || true
    fi

    # 验证安装结果
    if [[ ! -x "${INSTALL_DIR}/tjuaeui-web" ]]; then
        die "安装失败：未找到 ${INSTALL_DIR}/tjuaeui-web 或文件不可执行"
    fi

    success "安装完成"

    # 清理临时文件
    rm -rf "$TEMP_DIR"
}

create_symlink() {
    local symlink_path="${BIN_DIR}/tjuaeui-web"
    local target_path="${INSTALL_DIR}/tjuaeui-web"

    info "正在创建符号链接：${BOLD}${symlink_path}${NC} -> ${target_path}"

    # BIN_DIR 不存在时创建
    mkdir -p "$BIN_DIR"

    # 符号链接已存在时删除旧链接
    if [[ -L "$symlink_path" ]]; then
        warn "符号链接已存在，正在删除旧链接"
        rm "$symlink_path"
    elif [[ -e "$symlink_path" ]]; then
        die "$symlink_path 已存在且不是符号链接，请手动移除。"
    fi

    # 创建符号链接
    ln -s "$target_path" "$symlink_path" || die "创建符号链接失败"

    success "符号链接已创建：$symlink_path"
}

update_shell_profile() {
    # 检查 PATH 是否已包含 BIN_DIR
    if [[ ":$PATH:" == *":${BIN_DIR}:"* ]]; then
        info "PATH 已包含 ${BOLD}${BIN_DIR}${NC}"
        return
    fi

    info "正在把 ${BOLD}${BIN_DIR}${NC} 添加到 shell 配置文件的 PATH..."

    # 检测当前 shell
    local shell_name
    shell_name="$(basename "$SHELL")"

    local profile_file=""
    case "$shell_name" in
        bash)
            if [[ -f "$HOME/.bashrc" ]]; then
                profile_file="$HOME/.bashrc"
            elif [[ -f "$HOME/.bash_profile" ]]; then
                profile_file="$HOME/.bash_profile"
            fi
            ;;
        zsh)
            profile_file="$HOME/.zshrc"
            ;;
        fish)
            profile_file="$HOME/.config/fish/config.fish"
            ;;
        *)
            warn "未知 shell：$shell_name。请手动把 ${BIN_DIR} 加入 PATH。"
            return
            ;;
    esac

    if [[ -z "$profile_file" ]]; then
        warn "未找到 shell 配置文件，请手动把 ${BIN_DIR} 加入 PATH。"
        return
    fi

    # PATH 配置行
    local path_line="export PATH=\"${BIN_DIR}:\$PATH\""

    # 检查配置是否已存在
    if grep -q "${BIN_DIR}" "$profile_file" 2>/dev/null; then
        info "$profile_file 中已存在 PATH 配置"
        return
    fi

    # 写入配置文件
    echo "" >> "$profile_file"
    echo "# 由 tjuaeui-web 安装程序添加" >> "$profile_file"
    echo "$path_line" >> "$profile_file"

    success "已将 PATH 写入 $profile_file"
    warn "请重启 shell，或运行：source $profile_file"
}

print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  🎉 TjuaeUI WebUI v${VERSION} 安装成功！${NC}"
    echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}📍 安装目录：${NC}  ${INSTALL_DIR}"
    if [[ "$CREATE_SYMLINK" == "1" ]]; then
        echo -e "  ${BOLD}📍 符号链接：${NC}  ${BIN_DIR}/tjuaeui-web"
    fi
    echo ""
    echo -e "  ${BOLD}🚀 用法：${NC}"
    echo ""
    if [[ "$CREATE_SYMLINK" == "1" && ":$PATH:" == *":${BIN_DIR}:"* ]]; then
        echo "    # 启动 TjuaeUI WebUI"
        echo "    tjuaeui-web start"
        echo ""
        echo "    # 查看版本"
        echo "    tjuaeui-web version"
    else
        echo "    # 使用完整路径启动 TjuaeUI WebUI"
        echo "    ${INSTALL_DIR}/tjuaeui-web start"
        echo ""
        echo "    # 或创建符号链接并加入 PATH："
        if [[ "$CREATE_SYMLINK" == "1" ]]; then
            echo "    export PATH=\"${BIN_DIR}:\$PATH\""
        else
            echo "    ln -s ${INSTALL_DIR}/tjuaeui-web ~/.local/bin/tjuaeui-web"
            echo "    export PATH=\"~/.local/bin:\$PATH\""
        fi
    fi
    echo ""
    echo -e "  ${BOLD}📖 文档：${NC}  https://github.com/liangboqiang/TjuaeUI"
    echo -e "  ${BOLD}🐛 报告问题：${NC}  https://github.com/liangboqiang/TjuaeUI/issues"
    echo ""
    echo -e "  ${BOLD}🗑️  卸载：${NC}"
    echo ""
    echo "    # 删除安装目录"
    echo "    rm -rf ${INSTALL_DIR}"
    if [[ "$CREATE_SYMLINK" == "1" ]]; then
        echo ""
        echo "    # 删除符号链接"
        echo "    rm ${BIN_DIR}/tjuaeui-web"
    fi
    if [[ "$UPDATE_PATH" == "1" ]]; then
        echo ""
        echo "    # 从 shell 配置文件中删除 PATH 配置"
        echo "    # （手动编辑 ~/.bashrc 或 ~/.zshrc）"
    fi
    echo ""
}

# ─── 主流程 ──────────────────────────────────────────────────────────────────
main() {
    banner
    parse_args "$@"

    # 步骤 1：检测平台和架构
    detect_platform_arch

    # 步骤 2：必要时解析版本
    resolve_version

    # 步骤 3：下载压缩包
    download_tarball

    # 步骤 4：验证 SHA256 校验和
    verify_checksum

    # 步骤 5：解压压缩包
    extract_tarball

    # 步骤 6：创建符号链接
    if [[ "$CREATE_SYMLINK" == "1" ]]; then
        create_symlink
    fi

    # 步骤 7：更新 shell 配置文件中的 PATH
    if [[ "$UPDATE_PATH" == "1" ]]; then
        update_shell_profile
    fi

    # 步骤 8：输出摘要
    print_summary
}

# 执行
main "$@"

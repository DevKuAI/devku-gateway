# 在 1Panel 部署 Gateway Release 镜像

本文档用于在安装了 1Panel 的 VPS 上部署 Gateway Release 镜像。VPS 只需要保存并定时执行 `sync-release-mirror.sh`，不需要克隆 Gateway 仓库。

同步脚本执行以下操作：

- 获取 GitHub 上最新的 Gateway Release 版本。
- 下载 macOS、Linux 和 Windows 安装包。
- 使用 `checksums.txt` 校验全部安装包的 SHA-256。
- 生成使用镜像地址的 `install.sh` 和 `install.ps1`。
- 更新镜像目录中的 `releases/latest.txt`。

本文档以 `download.example.com` 为示例域名。部署时，将文档中的 `download.example.com` 替换为实际域名。如果 1Panel 生成的网站目录名称不同，还需要将路径中的网站目录名替换为面板显示的实际名称。

示例部署信息如下：

| 用途 | 路径或地址 | 使用位置 |
| --- | --- | --- |
| 同步脚本 | `/opt/devku-gateway/sync-release-mirror.sh` | VPS 宿主机 |
| 静态文件目录 | `/opt/1panel/www/sites/download.example.com/index` | VPS 宿主机和同步脚本 |
| OpenResty 网站根目录 | `/www/sites/download.example.com/index` | 1Panel OpenResty 容器 |
| 公开下载地址 | `https://download.example.com` | 安装脚本和客户端 |

> [!IMPORTANT]
> 同步脚本运行在宿主机上，因此 `--output-dir` 必须使用 `/opt/1panel/...` 路径。网站运行在 1Panel 的 OpenResty 容器中，因此 `root` 必须使用 `/www/sites/...` 路径。不要混用这两个路径。

## 前置条件

开始部署前，确认服务器满足以下条件：

- 已在 1Panel 中创建网站 `download.example.com`，并完成 DNS 和 HTTPS 配置。
- VPS 可以访问 `github.com` 和 GitHub Release 下载地址。
- VPS 已安装 `curl`、`awk`、`grep`、`mktemp`、`sed` 和 `cmp`。
- VPS 已安装 `sha256sum` 或 `shasum`。
- 执行同步脚本的用户可以写入 `/opt/1panel/www/sites/download.example.com/index`。

## 部署同步脚本

1. 在 VPS 上创建脚本目录：

   ```bash
   sudo mkdir -p /opt/devku-gateway
   ```

2. 使用 1Panel「文件」功能，将 `sync-release-mirror.sh` 上传到 `/opt/devku-gateway`。

3. 设置脚本权限：

   ```bash
   sudo chmod 0755 /opt/devku-gateway/sync-release-mirror.sh
   ```

服务器只需要上传这一个文件。`install.sh` 和 `install.ps1` 由同步脚本自动生成。

## 首次同步 Release

1. 创建 1Panel 网站的宿主机静态目录：

   ```bash
   sudo mkdir -p /opt/1panel/www/sites/download.example.com/index
   ```

2. 手动执行首次同步：

   ```bash
   sudo /opt/devku-gateway/sync-release-mirror.sh \
     --output-dir /opt/1panel/www/sites/download.example.com/index \
     --public-base-url https://download.example.com
   ```

正常完成后，终端会显示同步版本和两个安装脚本的公开地址。静态目录结构如下，其中 `vX.Y.Z` 表示实际同步的版本：

```text
/opt/1panel/www/sites/download.example.com/index/
├── install.ps1
├── install.sh
└── releases/
    ├── latest.txt
    └── vX.Y.Z/
        ├── checksums.txt
        ├── gateway_X.Y.Z_darwin_amd64.tar.gz
        ├── gateway_X.Y.Z_darwin_arm64.tar.gz
        ├── gateway_X.Y.Z_linux_amd64.tar.gz
        ├── gateway_X.Y.Z_linux_arm64.tar.gz
        ├── gateway_X.Y.Z_windows_amd64.zip
        └── gateway_X.Y.Z_windows_arm64.zip
```

## 配置 1Panel 网站

1. 在 1Panel 中进入「网站」，打开 `download.example.com` 的网站配置。
2. 打开 OpenResty 配置文件。
3. 保留 1Panel 已生成的 `listen`、`server_name`、SSL、ACME、日志和安全规则。
4. 将现有 `root` 替换为以下容器内路径：

   ```nginx
   root /www/sites/download.example.com/index;
   ```

5. 替换现有的 `location /`，并添加安装脚本和 Release 文件的静态文件规则：

   ```nginx
   location / {
       try_files $uri =404;
   }

   location = /install.sh {
       try_files $uri =404;
       default_type text/plain;
       add_header Cache-Control "no-cache" always;
   }

   location = /install.ps1 {
       try_files $uri =404;
       default_type text/plain;
       add_header Cache-Control "no-cache" always;
   }

   location = /releases/latest.txt {
       try_files $uri =404;
       default_type text/plain;
       add_header Cache-Control "no-cache" always;
   }

   location ^~ /releases/ {
       try_files $uri =404;
       add_header Cache-Control "public, max-age=31536000, immutable" always;
   }
   ```

不要重复添加第二个 `location /`。如果原配置已经存在 `location /`，直接替换原配置块。

6. 保存配置。1Panel 会检查配置并重新加载 OpenResty。如果 1Panel 报告语法错误，不要强制重新加载；先恢复到保存前的配置，再检查重复的 `location` 或缺失的括号。

版本目录中的文件不会改变，可以使用长期缓存。`install.sh`、`install.ps1` 和 `releases/latest.txt` 会随最新版本更新，因此不能使用长期缓存。

## 配置 1Panel 计划任务

1. 在 1Panel 中进入「计划任务」，创建计划任务。
2. 将任务类型设置为 `Shell Script`。
3. 将执行周期设置为每 10 分钟一次，也可以根据发布频率延长周期。
4. 输入以下脚本内容：

   ```bash
   #!/bin/sh
   set -eu

   /opt/devku-gateway/sync-release-mirror.sh \
     --output-dir /opt/1panel/www/sites/download.example.com/index \
     --public-base-url https://download.example.com
   ```

5. 保存任务后，手动执行一次，并检查 1Panel 的任务日志。

没有新版本时，同步脚本只获取 `checksums.txt` 并校验本地文件，不会重复下载安装包。1Panel 的任务日志会保留同步结果和失败信息。

## 验证部署结果

### 检查宿主机文件

```bash
sudo test -f /opt/1panel/www/sites/download.example.com/index/install.sh
sudo test -f /opt/1panel/www/sites/download.example.com/index/install.ps1
sudo cat /opt/1panel/www/sites/download.example.com/index/releases/latest.txt
```

三条命令都成功时，说明同步结果已经写入宿主机目录。

### 检查公开地址

```bash
curl -fsSL https://download.example.com/releases/latest.txt
curl -fsS -o /dev/null -w '%{http_code}\n' https://download.example.com/install.sh
curl -fsS -o /dev/null -w '%{http_code}\n' https://download.example.com/install.ps1
```

第一条命令应输出版本标签，例如 `vX.Y.Z`。后两条命令都应输出 `200`。

继续验证当前版本的校验文件：

```bash
release_tag=$(curl -fsSL https://download.example.com/releases/latest.txt)
curl -fsS -o /dev/null -w '%{http_code}\n' \
  "https://download.example.com/releases/${release_tag}/checksums.txt"
```

命令应输出 `200`。

### 验证安装

在 macOS 或 Linux 测试设备上执行：

```bash
curl -fsSL https://download.example.com/install.sh | sh
gateway --version
```

在 Windows PowerShell 测试设备上执行：

```powershell
irm https://download.example.com/install.ps1 | iex
gateway --version
```

## 手动同步指定版本

计划任务不需要指定版本。需要同步历史版本时，增加 `--version`：

```bash
sudo /opt/devku-gateway/sync-release-mirror.sh \
  --output-dir /opt/1panel/www/sites/download.example.com/index \
  --public-base-url https://download.example.com \
  --version vX.Y.Z
```

客户端可以通过 `GOMODEL_VERSION` 安装镜像中已有的指定版本：

```bash
curl -fsSL https://download.example.com/install.sh | GOMODEL_VERSION=vX.Y.Z sh
```

## 故障排查

### 公开地址返回 404

先确认宿主机文件存在：

```bash
sudo ls -la /opt/1panel/www/sites/download.example.com/index
sudo cat /opt/1panel/www/sites/download.example.com/index/releases/latest.txt
```

如果文件不存在，重新执行首次同步命令，并检查同步脚本的错误输出。

如果文件存在，确认 OpenResty 容器可以读取映射后的目录：

```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -Ei 'openresty|nginx'
openresty_container='replace-with-openresty-container-name'
docker exec "$openresty_container" \
  ls -la /www/sites/download.example.com/index
```

将 `replace-with-openresty-container-name` 替换为第一条命令输出的 OpenResty 容器名称。

如果容器内看不到文件，检查 1Panel OpenResty 容器的目录挂载：

```bash
docker inspect "$openresty_container" \
  --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

挂载信息应包含从宿主机 `/opt/1panel/www/sites` 到容器 `/www/sites` 的映射。如果实际映射不同，以 `docker inspect` 的结果为准，同时更新同步脚本的 `--output-dir` 和 OpenResty 的 `root`。

如果容器内文件存在，检查网站配置是否满足以下条件：

- `root` 是 `/www/sites/download.example.com/index`，不是宿主机的 `/opt/1panel/...` 路径。
- 网站配置中只有一个 `location /`。
- 请求命中了 `download.example.com` 对应的 `server` 配置。
- 1Panel 已成功保存配置并重新加载 OpenResty。

### 公开地址返回 403

检查网站目录和文件权限：

```bash
sudo ls -ld \
  /opt/1panel/www/sites/download.example.com \
  /opt/1panel/www/sites/download.example.com/index \
  /opt/1panel/www/sites/download.example.com/index/releases
sudo ls -l /opt/1panel/www/sites/download.example.com/index
```

OpenResty 需要目录的读取和进入权限，以及文件的读取权限。如果该目录只用于公开下载，可以修正静态目录权限：

```bash
sudo find /opt/1panel/www/sites/download.example.com/index -type d -exec chmod 0755 {} +
sudo find /opt/1panel/www/sites/download.example.com/index -type f -exec chmod 0644 {} +
sudo chmod 0755 /opt/1panel/www/sites/download.example.com/index/install.sh
```

如果权限正常，检查 1Panel 的网站访问限制、WAF 规则和 OpenResty 配置中的 `deny` 规则是否拦截了下载路径。

### 提示另一个同步任务正在运行

先检查是否存在运行中的同步进程：

```bash
ps aux | grep '[s]ync-release-mirror.sh'
```

如果同步进程仍在运行，等待任务结束，不要删除锁目录。

确认没有同步进程后，删除遗留的锁目录：

```bash
sudo rmdir \
  /opt/1panel/www/sites/download.example.com/index/.gateway-release-sync.lock
```

### 提示校验和不同

同一版本的 Release 文件应保持不变。出现校验和不同时，同步脚本会停止，不会覆盖现有文件。

检查 GitHub Release 是否重新上传了同名文件，并检查镜像目录中的文件是否被修改。在确认原因之前，不要删除或替换已有版本目录。

### 无法获取最新版本

检查 VPS 是否可以访问 Gateway 的 GitHub Release：

```bash
curl -fsSLI -o /dev/null -w '%{url_effective}\n' \
  https://github.com/DevKuAI/devku-gateway/releases/latest
```

命令应输出实际版本的 Release 地址。如果请求失败，检查 VPS 的 DNS、代理、防火墙和出站网络配置。

镜像服务器本身必须能够访问 GitHub。如果 VPS 无法访问 GitHub，同步脚本无法获取新的 Release；这种情况不能通过修改 1Panel 的网站配置解决。

# Gateway Release 镜像部署

本文档用于在可访问 GitHub 的 VPS 上部署 Gateway Release 镜像。镜像服务器只需要保存并定时执行 `sync-release-mirror.sh`，不需要克隆完整仓库。

同步脚本执行以下操作：

- 获取 GitHub 上最新的 Gateway Release 版本。
- 下载 macOS、Linux 和 Windows 安装包。
- 使用 `checksums.txt` 校验全部安装包的 SHA-256。
- 生成使用镜像地址的 `install.sh` 和 `install.ps1`。
- 更新镜像目录中的 `releases/latest.txt`。

## 前置条件

服务器需要满足以下条件：

- 可以访问 `github.com` 和 GitHub Release 下载地址。
- 已安装 `curl`、`awk`、`grep`、`mktemp`、`sed` 和 `cmp`。
- 已安装 `sha256sum` 或 `shasum`。
- 已准备可通过 HTTPS 访问的静态文件目录。

本文档使用以下示例配置：

```text
脚本路径：/opt/devku-gateway/sync-release-mirror.sh
静态目录：/var/www/devku-gateway
下载地址：https://download.example.com
```

请将 `download.example.com` 替换为实际域名。

## 部署同步脚本

1. 将 `sync-release-mirror.sh` 上传到服务器。

2. 安装脚本并创建静态目录：

   ```bash
   sudo mkdir -p /opt/devku-gateway /var/www/devku-gateway
   sudo install -m 0755 sync-release-mirror.sh /opt/devku-gateway/sync-release-mirror.sh
   ```

3. 手动执行一次同步：

   ```bash
   sudo /opt/devku-gateway/sync-release-mirror.sh \
     --output-dir /var/www/devku-gateway \
     --public-base-url https://download.example.com
   ```

脚本默认同步 GitHub 上的最新版本。正常完成后，终端会显示同步版本和两个安装脚本的公开地址。

## 配置 Nginx

以下示例将 `/var/www/devku-gateway` 作为下载域名的根目录：

```nginx
server {
    listen 443 ssl;
    server_name download.example.com;

    root /var/www/devku-gateway;

    location / {
        try_files $uri =404;
    }

    location = /install.sh {
        add_header Cache-Control "no-cache";
    }

    location = /install.ps1 {
        add_header Cache-Control "no-cache";
    }

    location = /releases/latest.txt {
        add_header Cache-Control "no-cache";
    }
}
```

SSL 证书配置需要根据服务器现有环境补充。修改配置后，检查并重新加载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

版本目录中的文件不会改变，可以配置长期缓存。`install.sh`、`install.ps1` 和 `releases/latest.txt` 不应使用长期缓存。

## 配置定时同步

在 `/etc/cron.d/devku-gateway-release-mirror` 中写入以下内容：

```cron
*/10 * * * * root /opt/devku-gateway/sync-release-mirror.sh --output-dir /var/www/devku-gateway --public-base-url https://download.example.com >> /var/log/devku-gateway-release-mirror.log 2>&1
```

该任务每 10 分钟检查一次最新版本。没有新版本时，脚本只下载 `checksums.txt` 并校验本地文件，不会重复下载安装包。

## 验证部署结果

1. 检查最新版本：

   ```bash
   curl -fsSL https://download.example.com/releases/latest.txt
   ```

2. 检查安装脚本：

   ```bash
   curl -fsSL -o /dev/null -w '%{http_code}\n' https://download.example.com/install.sh
   curl -fsSL -o /dev/null -w '%{http_code}\n' https://download.example.com/install.ps1
   ```

   两条命令都应返回 `200`。

3. 在测试设备上执行安装：

   macOS 或 Linux：

   ```bash
   curl -fsSL https://download.example.com/install.sh | sh
   ```

   Windows PowerShell：

   ```powershell
   irm https://download.example.com/install.ps1 | iex
   ```

4. 检查安装版本：

   ```bash
   gateway --version
   ```

## 指定版本

定时任务不需要指定版本。需要手动同步历史版本时，增加 `--version`：

```bash
sudo /opt/devku-gateway/sync-release-mirror.sh \
  --output-dir /var/www/devku-gateway \
  --public-base-url https://download.example.com \
  --version v0.1.78
```

客户端可以通过 `GOMODEL_VERSION` 安装镜像中已有的指定版本：

```bash
curl -fsSL https://download.example.com/install.sh | GOMODEL_VERSION=v0.1.78 sh
```

## 故障排查

### 提示另一个同步任务正在运行

先检查是否存在运行中的同步进程：

```bash
ps aux | grep '[s]ync-release-mirror.sh'
```

确认没有同步进程后，删除遗留的锁目录：

```bash
sudo rmdir /var/www/devku-gateway/.gateway-release-sync.lock
```

不要在同步进程仍然运行时删除锁目录。

### 提示校验和不同

同一版本的 Release 文件应保持不变。出现校验和不同时，脚本会停止同步，不会覆盖现有文件。

检查 GitHub Release 是否重新上传了同名文件，并检查镜像目录中的文件是否被修改。在确认原因之前，不要删除或替换已有版本目录。

### 无法获取最新版本

检查 VPS 是否可以访问以下地址：

```bash
curl -I https://github.com/DevKuAI/devku-gateway/releases/latest
```

如果请求失败，检查服务器 DNS、代理、防火墙和出站网络配置。

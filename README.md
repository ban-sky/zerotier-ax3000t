# ZeroTier 1.16.2 for Xiaomi AX3000T (coolsnowwolf/lede)

为 **Xiaomi Mi Router AX3000T** 定制的 ZeroTier 软件包和 LuCI 应用，使用
[coolsnowwolf/lede](https://github.com/coolsnowwolf/lede) 源码在 GitHub Actions 中编译。

适配的固件环境：

| 项目 | 值 |
| --- | --- |
| 设备 | Xiaomi Mi Router AX3000T (MT7981B) |
| 固件 | LEDE R25.1.1 / LuCI Master (git-24.338.41706) |
| 内核 | 6.1.124 |
| 架构 | `aarch64_cortex-a53` |
| 源码基线 | `coolsnowwolf/lede` @ `f4a80a4ce1a67f20390131925503358df410b01f` |
| ZeroTier | 1.16.2 |

> 选择上面这个 lede 提交，是因为它的 `kernel-6.1` 正好是 **6.1.124**，与你的固件内核一致。
> `kmod-tun` 等内核模块对内核版本很敏感，版本不一致时无法安装或无法加载。

## 仓库内容

```
package/zerotier/                     ZeroTier 1.16.2 软件包（含 6 个上游补丁）
package/luci-app-zerotier/            LuCI 网页配置界面（JS 视图）
.github/workflows/build.yml           GitHub Actions 编译流程
```

LuCI 页面位于 **VPN → ZeroTier**，支持：

- 启用/禁用服务、设置监听端口；
- 添加/删除要加入的 ZeroTier 网络；
- 为每个网络设置 `allow_managed`、`allow_global`、`allow_default`、`allow_dns`；
- 实时显示服务运行状态；
- 一键打开 ZeroTier Central 授权页面。

## 编译（GitHub Actions）

把仓库推到 GitHub 后，有两种触发方式：

1. **手动**：Actions → *Build ZeroTier for Xiaomi AX3000T* → Run workflow；
2. **打标签**：推送 `v*` 标签（例如 `v1.16.2-r1`），编译完成后会自动创建 Release 并上传产物。

编译产物（Artifacts / Release）包括：

- `zerotier_*.ipk`
- `luci-app-zerotier_*.ipk`
- `kmod-tun_*.ipk`
- `libminiupnpc_*.ipk`、`libnatpmp_*.ipk`
- 依赖包（`libstdcpp`、`libatomic`、`ip`，若构建系统输出）
- `*sysupgrade.bin`（整机固件，可选备用）

首次完整编译约 1 小时。

> Artifacts 里包含整机编译出的**全部 ipk**（约 25 MB），不要执行 `opkg install *.ipk`。只安装下面列出的 ZeroTier 相关包即可。

## 安装

把 Artifacts 中的 ipk 下载到路由器（或从电脑 `scp` 上传），然后：

```sh
# 如果之前装过旧版 luci-app-zerotier，先移除它（旧包会占用 /etc/init.d/zerotier）
opkg remove luci-app-zerotier zerotier --force-depends

# 只安装 ZeroTier 相关包，不要装整个目录
opkg install libminiupnpc_*.ipk libnatpmp_*.ipk kmod-tun_*.ipk \
             zerotier_*.ipk luci-app-zerotier_*.ipk
```

如果 `libstdcpp`、`libatomic` 或 `ip` 未安装，`opkg` 会从软件源自动拉取；也可以单独安装 Artifacts 里对应的 ipk。

安装后刷新 LuCI，进入 **VPN → ZeroTier**：

1. 勾选 **Enable**，按需填写监听端口（留空使用默认 `9993`）；
2. 在 **Networks** 中点击 **Add network**，填入 16 位十六进制 Network ID；
3. 一般保持 `allow_managed` 开启，其余三个按需开启；
4. 保存并应用，服务会自动重启。

然后到 [ZeroTier Central](https://my.zerotier.com/) 找到该网络，勾选新出现的节点进行授权。

### 命令行

```sh
zerotier-cli info                 # 查看节点状态和地址
zerotier-cli listnetworks         # 查看已加入网络
zerotier-cli join <16位网络ID>    # 临时加入（重启后丢失，持久化请用 LuCI/UCI）
```

持久化配置在 `/etc/config/zerotier`，由 init 脚本在每次启动时生成
`/var/lib/zerotier-one` 下的运行配置。

## 防火墙 / 互通说明

ZeroTier 建立的 `zt*` 接口默认**不会**自动加入防火墙区域，因此：

- 路由器本身访问 ZeroTier 网络、以及 ZeroTier 客户端访问路由器，通常可直接工作；
- 若要让 ZeroTier 客户端访问路由器后面的 LAN 设备，需要在
  **Network → Firewall → Zones** 中新建/调整区域，把 `zt*` 接口纳管，并允许
  `zt` → `lan` 的转发；或者在自定义防火墙规则中放行。

本版本不自动修改防火墙，避免与已有的 fw3/fw4 配置冲突。

## 常见问题

**Q：`opkg install` 报内核版本不匹配？**
`kmod-tun` 必须与固件内核完全一致。本项目按 6.1.124 编译；如果你的固件内核不是
6.1.124，请修改 workflow 中的 `LEDE_COMMIT` 后重新编译。

**Q：LuCI 里看不到 VPN → ZeroTier？**
确认 `luci-app-zerotier` 已安装并且 LuCI 已刷新；可执行
`opkg list-installed | grep zerotier` 检查。

**Q：服务启动失败？**
查看日志：

```sh
logread | grep -i zerotier
/etc/init.d/zerotier restart
```

**Q：升级固件后还要重装吗？**
刷写新的 sysupgrade 固件会保留 `/etc/config`（除非不勾选保留配置），但
`kmod-tun` 和 `zerotier` 二进制需要与内核匹配；升级内核后请重新安装对应版本。

## 说明

- ZeroTier 源码：<https://github.com/zerotier/ZeroTierOne>
- 软件包结构参考 OpenWrt 官方 `net/zerotier`，补丁来自 OpenWrt packages。
- 本项目仅打包和适配，ZeroTier 本身遵循 MPL-2.0；LuCI 应用遵循 Apache-2.0。

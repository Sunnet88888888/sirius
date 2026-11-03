# Judge0 on its own server

Student code runs in privileged containers, so it is kept off the machine that holds the database and the secrets. The platform reaches Judge0 over a WireGuard tunnel; Judge0 listens only on the tunnel address and nothing on the Judge0 host is open to the internet except SSH.

berdinov.com: Judge0 host `judge0.nodehost.ru` (191.44.109.64, Node Host Frankfurt, same datacenter as the main server, about 11 ms apart), tunnel 10.10.0.1 (main) and 10.10.0.2 (Judge0).

## Host requirements
- KVM virtual machine (not a container VPS), Ubuntu 22.04 or 24.04, 2 vCPU and 2 GB RAM is enough to start (Judge0 itself uses about 0.5 GB; each run is capped at 256 MB), 20 GB disk.
- **cgroup v1.** Judge0 1.13.1 does not work on cgroup v2. Set `GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"` in `/etc/default/grub`, run `update-grub`, reboot, and check `stat -fc %T /sys/fs/cgroup` prints `tmpfs`.

## Install
```
apt-get install -y docker.io docker-compose-v2 wireguard ufw
# WireGuard: create /etc/wireguard/wg0.conf from wg0.conf.example on both hosts, then
systemctl enable --now wg-quick@wg0                  # ping 10.10.0.2 from the main server must work
# Firewall on the Judge0 host
ufw default deny incoming; ufw default allow outgoing
ufw allow 22/tcp
ufw allow from <main server IP> to any port 51820 proto udp
ufw allow in on wg0 from 10.10.0.1 to any port 2358 proto tcp
# first time: arm a safety switch, test a second SSH login, then cancel it
systemd-run --on-active=5min --unit=ufw-safety ufw disable; ufw --force enable
systemctl stop ufw-safety.timer
# Judge0
mkdir -p /opt/judge0 && chmod 700 /opt/judge0 && cd /opt/judge0
cp .../remote/docker-compose.yml .        # binds 10.10.0.2:2358 only
cp .../judge0.conf.example judge0.conf    # fill secrets; chmod 644 (the container user must read it; the directory is root-only)
docker compose up -d
```
On the main server set `LEARNHOUSE_JUDGE0_API_URL=http://10.10.0.2:2358` and the new client id/secret in `.env`, then `docker compose up -d`. Stop the old local stack (`cd /opt/judge0 && docker compose down`; its files and volume stay for a rollback).

## Check
- From the main server: `curl -H "X-Judge0-Client-ID: ..." -H "X-Judge0-Client-Secret: ..." http://10.10.0.2:2358/system_info` is 200, without headers 401.
- Trivial run is `Accepted`, an infinite loop is `Time Limit Exceeded`, a 700 MB allocation, a fork bomb, a network connect and a 500 MB file write are all stopped (results from 2026-11-03 are in `docs/WORKLOG.md`).
- After a reboot of the Judge0 host the tunnel, firewall and containers come back by themselves.

## Roll back to the local Judge0
On the main server: restore the `.env` backup `.env.bak-judge0-remote-*`, `cd /opt/judge0 && docker compose up -d`, `cd /opt/learnhouse && docker compose up -d`.

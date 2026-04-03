"""Temporary deploy script for Call Simulator voice-only update."""
import sys, os, base64, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import paramiko

HOST = "187.124.118.79"
USER = "root"
PASS = "LN-S9Gq-G?zktAbO"
REMOTE_DIR = "/opt/nwsmedia-crm"

FILES = {
    "frontend/src/pages/shared/CallSimulator.tsx": "frontend/src/pages/shared/CallSimulator.tsx",
    "backend/src/routes/simulator.ts": "backend/src/routes/simulator.ts",
}

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, username=USER, password=PASS, timeout=30)
    sftp = ssh.open_sftp()
    print("Connected.\n")

    local_base = r"c:\Users\mkane\Desktop\NWSMEDIA_CRM"

    for local_rel, remote_rel in FILES.items():
        local_path = os.path.join(local_base, local_rel)
        remote_path = f"{REMOTE_DIR}/{remote_rel}"
        print(f"Uploading {local_rel}...")

        # Ensure remote directory exists
        remote_dir = os.path.dirname(remote_path).replace("\\", "/")
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            ssh.exec_command(f"mkdir -p {remote_dir}")
            time.sleep(0.5)

        sftp.put(local_path, remote_path)
        print(f"  -> {remote_path}")

    sftp.close()
    print("\nAll files uploaded. Rebuilding Docker images...\n")

    # Rebuild backend and nginx, restart
    cmds = [
        f"cd {REMOTE_DIR} && docker compose -f docker-compose.prod.yml build backend nginx",
        f"cd {REMOTE_DIR} && docker compose -f docker-compose.prod.yml up -d backend nginx",
    ]

    for cmd in cmds:
        print(f"$ {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        exit_code = stdout.channel.recv_exit_status()
        if out.strip():
            print(out.strip()[:1000])
        if err.strip():
            print(err.strip()[:1000])
        if exit_code != 0:
            print(f"WARNING: exit code {exit_code}")
        print()

    # Verify
    print("Checking container status...")
    stdin, stdout, stderr = ssh.exec_command(f"cd {REMOTE_DIR} && docker compose -f docker-compose.prod.yml ps")
    print(stdout.read().decode('utf-8', errors='replace'))

    print("\nChecking backend logs (last 10 lines)...")
    stdin, stdout, stderr = ssh.exec_command(f"cd {REMOTE_DIR} && docker compose -f docker-compose.prod.yml logs --tail=10 backend")
    print(stdout.read().decode('utf-8', errors='replace')[:2000])

    ssh.close()
    print("\nDeploy complete!")

if __name__ == "__main__":
    main()

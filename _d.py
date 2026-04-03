import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("187.124.118.79", username="root", password="LN-S9Gq-G?zktAbO", timeout=30)
sftp = ssh.open_sftp()
sftp.put(r"c:\Users\mkane\Desktop\NWSMEDIA_CRM\frontend\src\components\ui\Button.tsx", "/opt/nwsmedia-crm/frontend/src/components/ui/Button.tsx")
sftp.close()
def run(cmd):
    print(f"  > {cmd[:120]}")
    _, o, e = ssh.exec_command(cmd, timeout=300)
    out=o.read().decode(errors='replace'); err=e.read().decode(errors='replace')
    if out.strip(): print(out.strip()[-600:])
    if err.strip():
        for l in err.strip().split('\n')[-6:]: print(l)
run("cd /opt/nwsmedia-crm && docker compose -f docker-compose.prod.yml build --no-cache nginx")
run("cd /opt/nwsmedia-crm && docker compose -f docker-compose.prod.yml up -d nginx")
ssh.close()
print("DONE")

#!/usr/bin/env python
import subprocess
import re
import os.path


subprocess.check_call(['fallocate', '-l', '2G', '/swapfile'])
subprocess.check_call(['mkswap', '/swapfile'])
subprocess.check_call(['swapon', '/swapfile'])

with open('/etc/fstab', 'rb') as f:
    fstab = f.read()
print(fstab)
with open('/etc/fstab', 'wb') as f:
    if fstab.endswith('\n'):
        fstab = fstab[:-1]
    f.write(fstab + '\n/swapfile   none    swap    sw    0   0' + '\n')

with open('/etc/default/grub', 'rb') as f:
    grub_lines = f.readlines()
re_grub_line = re.compile(r'')
for i, line in enumerate(grub_lines[:]):
    if line.startswith('GRUB_CMDLINE_LINUX_DEFAULT='):
        m = re.match(r'^GRUB_CMDLINE_LINUX_DEFAULT="(.+)?"$', line)
        previous = m.group(1)
        if previous:
            previous = previous + ' '
        grub_lines[i] = 'GRUB_CMDLINE_LINUX_DEFAULT="{} {}\n"'.format(
            previous, 'cgroup_enable=memory swapaccount=1')

with open('/etc/default/grub', 'wb') as f:
    f.writelines(grub_lines)
subprocess.check_call('update-grub')

with open('/etc/sysctl.conf', 'rb') as f:
    sysctl = f.read()
if sysctl.endswith('\n'):
    sysctl = sysctl[:-1]
with open('/etc/sysctl.conf', 'wb') as f:
    f.write('{}\nvm.swappiness = 10\nvm.vfs_cache_pressure = 50\n'.format(
        sysctl))

with open(os.path.expanduser('~/.bashrc'), 'rb') as f:
    bashrc = f.read()
with open(os.path.expanduser('~/.bashrc'), 'wb') as f:
    f.write("""{}

export LANGUAGE=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export LC_TYPE=en_US.UTF-8
export EDITOR=vim
""".format(bashrc))

if os.path.exist('/etc/localtime'):
    os.remove('/etc/localtime')
os.symlink('/usr/share/zoneinfo/UTC', '/etc/localtime')

subprocess.check_call('reboot')

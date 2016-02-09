#!/usr/bin/env python
import re
import os.path
import sys

root_dir = os.path.abspath(os.path.normpath(os.path.dirname(__file__)))
sys.path.insert(0, root_dir)
from _common import *


def _install_swap_memory():
    if os.path.exists('/swapfile'):
        run_command(['swapoff', '/swapfile'])
    run_command(['fallocate', '-l', '2G', '/swapfile'])
    os.chmod('/swapfile', 600)
    run_command(['mkswap', '/swapfile'])
    run_command(['swapon', '/swapfile'])

    with open('/etc/fstab', 'rt') as f:
        fstab = f.read()
    with open('/etc/fstab', 'wt') as f:
        if fstab.endswith('\n'):
            fstab = fstab[:-1]
        f.write(fstab + '\n/swapfile   none    swap    sw    0   0' + '\n')

    with open('/etc/default/grub', 'rt') as f:
        grub_lines = f.readlines()
    re_grub_line = re.compile(r'')
    for i, line in enumerate(grub_lines[:]):
        if line.startswith('GRUB_CMDLINE_LINUX_DEFAULT='):
            m = re.match(r'^GRUB_CMDLINE_LINUX_DEFAULT="(.+)?"$', line)
            previous = m.group(1)
            if previous:
                previous = previous + ' '
            grub_lines[i] = 'GRUB_CMDLINE_LINUX_DEFAULT="{} {}"\n'.format(
                previous, 'cgroup_enable=memory swapaccount=1')

    with open('/etc/default/grub', 'wt') as f:
        f.writelines(grub_lines)
    run_command('update-grub')

    with open('/etc/sysctl.conf', 'rt') as f:
        sysctl = f.read()
    if sysctl.endswith('\n'):
        sysctl = sysctl[:-1]
    with open('/etc/sysctl.conf', 'wt') as f:
        f.write('{}\nvm.swappiness = 10\nvm.vfs_cache_pressure = 50\n'.format(
            sysctl))


def _configure_shell():
    run_command(['locale-gen', 'UTF-8', ])
    with open(os.path.expanduser('~/.bashrc'), 'rt') as f:
        bashrc = f.read()
    with open(os.path.expanduser('~/.bashrc'), 'wt') as f:
        f.write("""{}

    export LANGUAGE=en_US.UTF-8
    export LC_ALL=en_US.UTF-8
    export LANG=en_US.UTF-8
    export LC_TYPE=en_US.UTF-8
    export EDITOR=vim
    """.format(bashrc))

    if os.path.exists('/etc/localtime'):
        os.remove('/etc/localtime')
    os.symlink('/usr/share/zoneinfo/UTC', '/etc/localtime')


def _configure_unattended_upgrades():
    log_info('Configuring unattended upgrades')
    run_command(['apt-get', 'install', '-y', 'unattended-upgrades', ])
    with open('/etc/apt/apt.conf.d/50unattended-upgrades', 'wt') as f:
        f.write("""Unattended-Upgrade::Allowed-Origins {
        "${distro_id}:${distro_codename}-security";
        "${distro_id}:${distro_codename}-updates";
};

Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::MailOnlyOnError "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
""")

_install_swap_memory()
_configure_shell()
_configure_unattended_upgrades()

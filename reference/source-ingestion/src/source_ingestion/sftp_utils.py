"""SFTP helpers: walk a remote tree, decide which files are new, copy them to a volume."""

from __future__ import annotations

import os
import posixpath
import stat
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class RemoteFile:
    path: str  # absolute remote path
    size: int
    mtime: int


def walk_remote(sftp: Any, root: str) -> list[RemoteFile]:
    """Recursively list regular files under `root`."""
    found: list[RemoteFile] = []
    for entry in sftp.listdir_attr(root):
        path = posixpath.join(root, entry.filename)
        if stat.S_ISDIR(entry.st_mode):
            found.extend(walk_remote(sftp, path))
        else:
            found.append(RemoteFile(path=path, size=int(entry.st_size), mtime=int(entry.st_mtime)))
    return sorted(found, key=lambda f: f.path)


def plan_transfers(remote: Iterable[RemoteFile], already_copied: set[tuple[str, int, int]]) -> list[RemoteFile]:
    """Files whose (path, size, mtime) the transfer log has not seen. A changed file counts as new."""
    return [f for f in remote if (f.path, f.size, f.mtime) not in already_copied]


def local_path(volume_dir: str, remote_path: str) -> str:
    """Keep the remote directory layout under the volume directory."""
    return os.path.join(volume_dir, remote_path.lstrip("/"))


def classify(path: str, text_suffixes: Iterable[str], binary_suffixes: Iterable[str]) -> str:
    suffix = posixpath.splitext(path)[1].lower()
    if suffix in set(text_suffixes):
        return "text"
    if suffix in set(binary_suffixes):
        return "binary"
    return "other"


class VolumeRemote:
    """Stand-in for an SFTP server when outbound SFTP is blocked: a directory tree behaves like the remote.

    It exposes the same `listdir_attr` and `get` calls the SFTP client does, so the copy logic is unchanged.
    """

    def __init__(self, root: str):
        self.root = root

    def _real(self, path: str) -> str:
        return os.path.join(self.root, path.lstrip("/"))

    def listdir_attr(self, path: str):
        entries = []
        for name in sorted(os.listdir(self._real(path))):
            info = os.stat(os.path.join(self._real(path), name))
            entries.append(type("Attr", (), {"filename": name, "st_mode": info.st_mode, "st_size": info.st_size, "st_mtime": info.st_mtime})())
        return entries

    def get(self, remote_path: str, local: str) -> None:
        import shutil

        shutil.copyfile(self._real(remote_path), local)

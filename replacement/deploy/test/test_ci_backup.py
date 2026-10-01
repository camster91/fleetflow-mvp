"""Restricted protocol and recovery archive reject staging, shell and altered input."""
import hashlib, importlib.util, io, json
from pathlib import Path
import shutil, tarfile, tempfile, unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('fleetvera_backup', Path(__file__).parents[1] / 'server' / 'ci-backup.py')
backup = importlib.util.module_from_spec(spec); spec.loader.exec_module(backup)

class BackupTests(unittest.TestCase):
    def test_protocol_allows_only_nonce_bound_backup_and_encrypted_download(self):
        sha, nonce = 'a' * 40, 'b' * 32
        archive = '/opt/fleetvera-rebuild-recovery/encrypted/fleetvera-production-full-20261001T060000Z.tar.gz.age'
        self.assertEqual(backup.parse_command(f'fleetvera-backup {sha} {nonce} 123'), ('backup', [sha, nonce, '123']))
        self.assertEqual(backup.parse_command('scp -f ' + archive), ('download', [archive]))
        for command in ['', 'bash', 'id', f'fleetvera-backup {sha} {nonce}', f'fleetvera-backup {sha} {nonce} 123;id', f'fleetvera-backup {sha} {nonce} foreign', f'fleetvera-backup {sha[:7]} {nonce} 123', 'scp -t ' + archive, 'scp -rf ' + archive, 'scp -f /etc/fleetvera-ci-backup.json', 'scp -f ' + archive.replace('production', 'staging'), 'scp -f ' + archive + '.proof.json', 'scp -f ' + archive.replace('/encrypted/', '/encrypted/../'), 'sftp']:
            with self.subTest(command=command): self.assertRaises(ValueError, backup.parse_command, command)

    def test_staging_is_only_an_explicit_operator_rehearsal(self):
        settings = {'resource_uuid': 'a' * 24, 'database': 'fleetvera_rebuild_production'}
        self.assertEqual(backup.configuration(settings), settings)
        settings['database'] = 'fleetvera_rebuild_staging'
        self.assertRaises(ValueError, backup.configuration, settings)
        self.assertEqual(backup.configuration(settings, rehearsal=True), settings)
        settings['database'] = 'fleetflow'
        self.assertRaises(ValueError, backup.configuration, settings, True)
        settings['database'] = 'fleetvera_rebuild_production'; settings['resource_uuid'] = '../foreign'
        self.assertRaises(ValueError, backup.configuration, settings)

    def bundle(self, source, mode='valid'):
        entries = {name: b'fixture' for name in backup.FILES}
        entries['release.json'] = json.dumps({'database': 'fleetvera_rebuild_production', 'revision': 'a' * 40, 'resource_uuid': 'b' * 24, 'snapshotConsistent': True, 'rehearsal': False}).encode()
        manifest = {name: hashlib.sha256(value).hexdigest() for name, value in entries.items()}
        if mode == 'tampered': entries['database.dump'] = b'changed'
        entries['manifest.json'] = json.dumps(manifest).encode()
        if mode == 'missing': del entries['images.tar']
        with tarfile.open(source, 'w:gz') as bundle:
            for name, value in entries.items():
                entry = tarfile.TarInfo(name); entry.size = len(value); bundle.addfile(entry, io.BytesIO(value))
            if mode in ('duplicate', 'traversal', 'symlink'):
                name = 'database.dump' if mode == 'duplicate' else '../evil'
                entry = tarfile.TarInfo(name)
                if mode == 'symlink': entry.name = 'link'; entry.type = tarfile.SYMTYPE; entry.linkname = '/etc/passwd'
                bundle.addfile(entry)

    def test_manifest_contents_are_verified_before_restore(self):
        for mode in ['valid', 'tampered', 'missing', 'duplicate', 'traversal', 'symlink']:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                root = Path(directory); source = root / 'source.tar.gz'; work = root / 'work'; work.mkdir(); self.bundle(source, mode)
                def decrypt(args, **options): shutil.copyfile(source, work / 'bundle.tar.gz')
                with patch.object(backup, 'require', side_effect=decrypt):
                    if mode == 'valid': self.assertEqual(backup.unpack_verified(root / 'encrypted.age', work)['database'], 'fleetvera_rebuild_production')
                    else: self.assertRaises(ValueError, backup.unpack_verified, root / 'encrypted.age', work)

if __name__ == '__main__': unittest.main()

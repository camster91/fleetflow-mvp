import copy,hashlib,importlib.util,io,json,os,pathlib,shutil,tarfile,tempfile,unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('checked_image',pathlib.Path(__file__).parents[1]/'deploy/checked-image.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
REVISION='a'*40
class CheckedImage(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.directory=pathlib.Path(self.temp.name);self.env=patch.dict(os.environ,{'RELEASE_SHA':REVISION,'GITHUB_RUN_ID':'42','GITHUB_RUN_ATTEMPT':'1'},clear=True);self.env.start();module.KIND='runtime'
 def tearDown(self):self.env.stop();self.temp.cleanup()
 def fixture(self,kind='runtime',user=None,command=None,tag=None,layout='docker'):
  module.KIND=kind;settings={'User':user or module.KINDS[kind]['user'],'Labels':{'org.opencontainers.image.revision':REVISION},'Env':['RELEASE_SHA='+REVISION],'Cmd':(['node','src/server.mjs'] if kind=='runtime' else None),'Entrypoint':(['docker-entrypoint.sh'] if kind=='runtime' else ['/provision-runtime-role.sh'])}
  if command is not None:settings['Cmd']=command
  config={'config':settings,'architecture':'amd64','os':'linux','rootfs':{'type':'layers','diff_ids':['sha256:'+hashlib.sha256(b'layer').hexdigest()]}};raw=json.dumps(config).encode();image='sha256:'+hashlib.sha256(raw).hexdigest()
  config_path=('blobs/sha256/'+hashlib.sha256(raw).hexdigest() if layout=='oci' else 'config.json')
  layer_path=('blobs/sha256/'+hashlib.sha256(b'layer').hexdigest() if layout=='oci' else 'layer.tar')
  entries=[('manifest.json',json.dumps([{'Config':config_path,'RepoTags':[tag or module.import_tag(REVISION)],'Layers':[layer_path]}]).encode()),(config_path,raw),(layer_path,b'layer')]
  if layout=='oci':
   descriptor={'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':{'mediaType':'application/vnd.oci.image.config.v1+json','digest':image,'size':len(raw)},'layers':[{'mediaType':'application/vnd.oci.image.layer.v1.tar','digest':'sha256:'+hashlib.sha256(b'layer').hexdigest(),'size':5}]}
   descriptor_raw=json.dumps(descriptor).encode();descriptor_id=hashlib.sha256(descriptor_raw).hexdigest()
   entries.extend([('oci-layout',b'{"imageLayoutVersion":"1.0.0"}'),('index.json',json.dumps({'schemaVersion':2,'manifests':[{'mediaType':'application/vnd.oci.image.manifest.v1+json','digest':'sha256:'+descriptor_id,'size':len(descriptor_raw)}]}).encode()),('blobs/sha256/'+descriptor_id,descriptor_raw)])
  with tarfile.open(self.directory/'runtime-image.tar','w') as bundle:
   for name,data in entries:
    entry=tarfile.TarInfo(name);entry.size=len(data);bundle.addfile(entry,io.BytesIO(data))
  receipt={'schema':1,'repository':module.REPOSITORY,'revision':REVISION,'kind':kind,'image_id':image,'archive_sha256':module.digest(self.directory/'runtime-image.tar'),'workflow_run_id':'42','workflow_run_attempt':'1'};self.write(receipt);return receipt,config
 def write(self,receipt):(self.directory/'receipt.json').write_text(json.dumps(receipt))
 def test_accepts_both_distinct_image_kinds(self):
  for kind in module.KINDS:
   receipt,_=self.fixture(kind);self.assertEqual(module.verify(self.directory),receipt)
 def test_rejects_tampered_archive_before_import(self):
  self.fixture();(self.directory/'runtime-image.tar').write_bytes(b'changed');self.assertRaises(ValueError,module.verify,self.directory)
 def test_rejects_wrong_repository_revision_kind_and_run(self):
  for field,value in [('repository','foreign/repo'),('revision','b'*40),('kind','role-init'),('workflow_run_id','99'),('workflow_run_attempt','2')]:
   receipt,_=self.fixture();receipt[field]=value;self.write(receipt);self.assertRaises(ValueError,module.verify,self.directory)
 def test_rejects_privileged_user_command_and_wrong_import_tag(self):
  for args in [{'user':'root'},{'command':['sh']},{'tag':'fleetvera:latest'}]:
   self.fixture(**args);self.assertRaises(ValueError,module.verify,self.directory)
  self.fixture(kind='role-init',command=['postgres']);self.assertRaises(ValueError,module.verify,self.directory)
 def test_rejects_forged_configuration_identity(self):
  receipt,_=self.fixture();receipt['image_id']='sha256:'+'f'*64;self.write(receipt);self.assertRaises(ValueError,module.verify,self.directory)
 def test_loaded_identity_allows_engine_manifest_ids_but_checks_contents(self):
  receipt,config=self.fixture();loaded={'Id':'sha256:'+'b'*64,'Config':config['config'],'RootFS':{'Layers':config['rootfs']['diff_ids']},'Architecture':'amd64','Os':'linux'}
  with patch.object(module.subprocess,'check_output',return_value=json.dumps([loaded])):self.assertEqual(module.verify_loaded(self.directory,receipt),loaded)
  loaded['RootFS']['Layers']=['sha256:'+'c'*64]
  with patch.object(module.subprocess,'check_output',return_value=json.dumps([loaded])):self.assertRaises(ValueError,module.verify_loaded,self.directory,receipt)
 def test_loaded_legacy_inspect_defaults_are_equivalent_to_absent_fields(self):
  receipt,config=self.fixture();loaded={'Id':'sha256:'+'b'*64,'Config':dict(config['config'],Hostname='',Domainname='',Image='',AttachStdin=False,AttachStdout=False,AttachStderr=False,Tty=False,OpenStdin=False,StdinOnce=False),'RootFS':{'Layers':config['rootfs']['diff_ids']},'Architecture':'amd64','Os':'linux'}
  with patch.object(module.subprocess,'check_output',return_value=json.dumps([loaded])):self.assertEqual(module.verify_loaded(self.directory,receipt),loaded)
  for field,value in [('Hostname','changed'),('AttachStdin',True),('AttachStdin',0),('Image',None)]:
   changed=copy.deepcopy(loaded);changed['Config'][field]=value
   with patch.object(module.subprocess,'check_output',return_value=json.dumps([changed])):self.assertRaises(ValueError,module.verify_loaded,self.directory,receipt)
 def test_loaded_runtime_configuration_changes_remain_rejected(self):
  receipt,config=self.fixture();loaded={'Config':config['config'],'RootFS':{'Layers':config['rootfs']['diff_ids']},'Architecture':'amd64','Os':'linux'}
  for field,value in [('User','root'),('Env',['RELEASE_SHA='+REVISION,'EVIL=1']),('Cmd',['sh']),('Entrypoint',['sh']),('Labels',{}),('Volumes',{'/app':{}}),('Healthcheck',{'Test':['NONE']})]:
   changed=copy.deepcopy(loaded);changed['Config'][field]=value
   with patch.object(module.subprocess,'check_output',return_value=json.dumps([changed])):self.assertRaises(ValueError,module.verify_loaded,self.directory,receipt)
 def test_documented_empty_or_nil_fields_match_absent_but_nonempty_remain(self):
  settings={'Volumes':None,'OnBuild':None,'Cmd':[],'Labels':{},'WorkingDir':''}
  self.assertEqual(module.comparable_configuration(settings),{})
  self.assertEqual(module.comparable_configuration({'Volumes':{'/data':{}},'OnBuild':['RUN evil'],'Cmd':['sh']}),{'Volumes':{'/data':{}},'OnBuild':['RUN evil'],'Cmd':['sh']})
 def test_publishing_requires_a_checked_main_push(self):
  self.fixture()
  with patch.object(module.subprocess,'run') as run:
   self.assertRaises(ValueError,module.publish,self.directory);run.assert_not_called()
 def test_publication_tags_keep_both_checked_attempts_addressable(self):
  receipt,_=self.fixture();first=module.publication_tag(receipt);receipt['workflow_run_attempt']='2';second=module.publication_tag(receipt)
  self.assertNotEqual(first,second);self.assertTrue(first.endswith('-run-42-attempt-1'));self.assertTrue(second.endswith('-run-42-attempt-2'))
  receipt['workflow_run_id']='foreign';self.assertRaises(ValueError,module.publication_tag,receipt)
 def export_fixture(self,layout,manifest_id=False,change=None,kind='runtime'):
  receipt,config=self.fixture(layout=layout,kind=kind)
  archive=(self.directory/'runtime-image.tar').read_bytes()
  tested={'Id':('sha256:'+'b'*64 if manifest_id else receipt['image_id']),'Config':copy.deepcopy(config['config']),'RootFS':{'Layers':config['rootfs']['diff_ids']},'Architecture':'amd64','Os':'linux'}
  if change:change(tested)
  target=self.directory/'export'
  def docker_run(args,**kwargs):
   if args[:3]==['docker','image','save']:(target/'runtime-image.tar').write_bytes(archive)
  with patch.object(module.subprocess,'check_output',return_value=json.dumps([tested])),patch.object(module.subprocess,'run',side_effect=docker_run) as run:
   exported=module.export('tested-runtime',target)
   self.assertEqual(run.call_args_list[0].args[0],['docker','image','tag',tested['Id'],module.import_tag(REVISION)])
  return exported,receipt,target
 def test_exports_classic_and_containerd_save_layouts_with_configuration_identity(self):
  for kind in module.KINDS:
   for layout,manifest_id in [('docker',False),('oci',True)]:
    with self.subTest(layout=layout,kind=kind):
     exported,original,target=self.export_fixture(layout,manifest_id,kind=kind)
     self.assertEqual(exported['image_id'],original['image_id'])
     self.assertEqual(module.verify(target),exported)
     shutil.rmtree(target)
 def test_export_rejects_saved_contents_different_from_tested_image(self):
  changes=[(lambda image:image['Config'].update(WorkingDir='/different'),'configuration or filesystem differs'),(lambda image:image['RootFS'].update(Layers=['sha256:'+'c'*64]),'configuration or filesystem differs'),(lambda image:image.update(Architecture='arm64'),'platform differs'),(lambda image:image.update(Os='windows'),'platform differs')]
  for change,message in changes:
   with self.subTest(message=message),self.assertRaisesRegex(ValueError,message):self.export_fixture('oci',True,change)
   shutil.rmtree(self.directory/'export')
 def test_oci_save_rejects_forged_config_identity_and_archive_tampering(self):
  receipt,_=self.fixture(layout='oci');receipt['image_id']='sha256:'+'f'*64;self.write(receipt)
  self.assertRaises(ValueError,module.verify,self.directory)
  self.fixture(layout='oci');archive=self.directory/'runtime-image.tar';archive.write_bytes(archive.read_bytes()+b'tampered')
  self.assertRaises(ValueError,module.verify,self.directory)
 def test_oci_only_archive_without_docker_save_manifest_is_rejected(self):
  receipt,_=self.fixture(layout='oci')
  archive=self.directory/'runtime-image.tar'
  with tarfile.open(archive) as bundle:entries=[(entry,bundle.extractfile(entry).read()) for entry in bundle.getmembers() if entry.name!='manifest.json']
  with tarfile.open(archive,'w') as bundle:
   for entry,data in entries:bundle.addfile(entry,io.BytesIO(data))
  receipt['archive_sha256']=module.digest(archive);self.write(receipt)
  self.assertRaises(KeyError,module.verify,self.directory)
if __name__=='__main__':unittest.main()

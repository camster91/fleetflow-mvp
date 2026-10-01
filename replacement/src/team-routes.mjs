import {randomBytes,randomUUID} from 'node:crypto';
import {email,text,uuid,password,hashPassword,verifyPassword,tokenHash} from './security.mjs';
const roles=['owner','dispatcher','driver','mechanic'];
export function mountTeamRoutes({app,pool,requireAuth,route,access,mutate,Problem,issueSession}){
  const path='/api/workspaces/:workspaceId';
  app.post('/api/workspaces',requireAuth,route(async(req,res)=>{
    const id=randomUUID(),name=text(req.body?.name,1,120),client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('INSERT INTO fleetvera_rebuild.workspaces(id,name) VALUES($1,$2)',[id,name]);
      await client.query("INSERT INTO fleetvera_rebuild.memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",[id,req.user.id]);
      await client.query("INSERT INTO fleetvera_rebuild.audit_events(workspace_id,actor_id,action,target_id) VALUES($1,$2,'workspace.created',$1)",[id,req.user.id]);
      await client.query('COMMIT');res.status(201).json({id});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }));
  app.post(path,requireAuth,route(async(req,res)=>mutate(req,res,['owner'],'workspace.renamed',async client=>{
    await client.query('UPDATE fleetvera_rebuild.workspaces SET name=$2 WHERE id=$1',[req.params.workspaceId,text(req.body?.name,1,120)]);
    return {id:req.params.workspaceId,http:200};
  })));
  app.get(path+'/members',requireAuth,route(async(req,res)=>{
    const member=await access(pool,req.params.workspaceId,req.user.id);
    if(member.role!=='owner')throw new Problem(403,'ROLE_REJECTED');
    const members=await pool.query('SELECT u.id,u.email,u.display_name,m.role,m.version,m.revoked_at FROM fleetvera_rebuild.memberships m JOIN fleetvera_rebuild.users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.email',[req.params.workspaceId]);
    res.json({members:members.rows});
  }));
  app.post(path+'/members/:userId',requireAuth,route(async(req,res)=>mutate(req,res,['owner'],'membership.changed',async client=>{
    const id=req.params.userId;
    if(!uuid(id)||!Number.isSafeInteger(req.body?.expectedVersion)||typeof req.body?.revoked!=='boolean'||!roles.includes(req.body?.role))throw new Problem(400,'INVALID_INPUT');
    const result=await client.query('SELECT role,version,revoked_at FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE',[req.params.workspaceId,id]);
    if(!result.rowCount)throw new Problem(404,'NOT_FOUND');
    const current=result.rows[0];
    if(current.version!==req.body.expectedVersion)throw new Problem(409,'STALE_VERSION');
    if(!current.revoked_at&&current.role==='owner'&&(req.body.revoked||req.body.role!=='owner')){
      const count=await client.query("SELECT count(*)::integer AS count FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND role='owner' AND revoked_at IS NULL",[req.params.workspaceId]);
      if(count.rows[0].count<=1)throw new Problem(409,'LAST_OWNER');
    }
    if(req.body.revoked||req.body.role!=='driver'){
      const busy=await client.query("SELECT id FROM fleetvera_rebuild.deliveries WHERE workspace_id=$1 AND driver_id=$2 AND status IN ('assigned','in_transit')",[req.params.workspaceId,id]);
      if(busy.rowCount)throw new Problem(409,'DRIVER_HAS_ACTIVE_DELIVERY');
    }
    await client.query('UPDATE fleetvera_rebuild.memberships SET role=$3,revoked_at=CASE WHEN $4 THEN now() ELSE NULL END,version=version+1 WHERE workspace_id=$1 AND user_id=$2',[req.params.workspaceId,id,req.body.role,req.body.revoked]);
    return {id,http:200,audit:{from:current.role,to:req.body.role,revoked:req.body.revoked,previousVersion:current.version}};
  })));
  app.post(path+'/invitations',requireAuth,route(async(req,res)=>{
    const address=email(req.body?.email),role=req.body?.role;
    if(!roles.includes(role))throw new Problem(400,'INVALID_INPUT');
    const id=randomUUID(),token=randomBytes(32).toString('hex'),client=await pool.connect();
    try{
      await client.query('BEGIN');const member=await access(client,req.params.workspaceId,req.user.id,true);
      if(member.role!=='owner')throw new Problem(403,'ROLE_REJECTED');
      const existing=await client.query('SELECT 1 FROM fleetvera_rebuild.memberships m JOIN fleetvera_rebuild.users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND u.email=$2 AND m.revoked_at IS NULL',[req.params.workspaceId,address]);
      if(existing.rowCount)throw new Problem(409,'ALREADY_MEMBER');
      // A replacement invitation invalidates older outstanding links for this address.
      await client.query('UPDATE fleetvera_rebuild.invitations SET revoked_at=now() WHERE workspace_id=$1 AND email=$2 AND accepted_at IS NULL AND revoked_at IS NULL',[req.params.workspaceId,address]);
      await client.query("INSERT INTO fleetvera_rebuild.invitations(id,workspace_id,email,role,token_hash,issuer_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days')",[id,req.params.workspaceId,address,role,tokenHash(token),req.user.id]);
      await client.query("INSERT INTO fleetvera_rebuild.audit_events(workspace_id,actor_id,action,target_id) VALUES($1,$2,'invitation.created',$3)",[req.params.workspaceId,req.user.id,id]);
      await client.query('COMMIT');res.status(201).json({id,token});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }));
  app.post(path+'/invitations/:invitationId/revoke',requireAuth,route(async(req,res)=>mutate(req,res,['owner'],'invitation.revoked',async client=>{
    if(!uuid(req.params.invitationId))throw new Problem(404,'NOT_FOUND');
    const result=await client.query('UPDATE fleetvera_rebuild.invitations SET revoked_at=now() WHERE workspace_id=$1 AND id=$2 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id',[req.params.workspaceId,req.params.invitationId]);
    if(!result.rowCount)throw new Problem(404,'NOT_FOUND');return {id:result.rows[0].id,http:200};
  })));
  app.post('/api/auth/invitations/accept',route(async(req,res)=>{
    if(!/^[a-f0-9]{64}$/.test(req.body?.token||''))throw new Problem(403,'INVITATION_REJECTED');
    const address=email(req.body.email),candidate=password(req.body.password),client=await pool.connect();
    try{
      await client.query('BEGIN');
      const found=await client.query('SELECT workspace_id FROM fleetvera_rebuild.invitations WHERE token_hash=$1',[tokenHash(req.body.token)]);
      if(!found.rowCount)throw new Problem(403,'INVITATION_REJECTED');
      const workspace=found.rows[0].workspace_id;
      await client.query('SELECT id FROM fleetvera_rebuild.workspaces WHERE id=$1 FOR UPDATE',[workspace]);
      const result=await client.query('SELECT * FROM fleetvera_rebuild.invitations WHERE token_hash=$1 AND email=$2 AND expires_at>now() AND accepted_at IS NULL AND revoked_at IS NULL FOR UPDATE',[tokenHash(req.body.token),address]);
      if(!result.rowCount)throw new Problem(403,'INVITATION_REJECTED');
      const invite=result.rows[0],issuer=await client.query("SELECT 1 FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND user_id=$2 AND role='owner' AND revoked_at IS NULL",[workspace,invite.issuer_id]);
      if(!issuer.rowCount)throw new Problem(403,'INVITATION_REJECTED');
      const user=await client.query('SELECT id,password_hash FROM fleetvera_rebuild.users WHERE email=$1 FOR UPDATE',[address]);
      let id=user.rows[0]?.id;
      if(id){if(!await verifyPassword(candidate,user.rows[0].password_hash))throw new Problem(403,'INVITATION_REJECTED');}
      else{id=randomUUID();await client.query('INSERT INTO fleetvera_rebuild.users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[id,address,text(req.body.name,1,100),await hashPassword(candidate)]);}
      const membership=await client.query('SELECT revoked_at FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND user_id=$2',[workspace,id]);
      if(membership.rowCount&&!membership.rows[0].revoked_at)throw new Problem(409,'ALREADY_MEMBER');
      await client.query('INSERT INTO fleetvera_rebuild.memberships(workspace_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=$3,revoked_at=NULL,version=fleetvera_rebuild.memberships.version+1',[workspace,id,invite.role]);
      await client.query('UPDATE fleetvera_rebuild.invitations SET accepted_at=now() WHERE id=$1',[invite.id]);
      await client.query("INSERT INTO fleetvera_rebuild.audit_events(workspace_id,actor_id,action,target_id) VALUES($1,$2,'invitation.accepted',$3)",[workspace,id,invite.id]);
      await issueSession(client,res,id);await client.query('COMMIT');res.json({workspaceId:workspace});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }));
}

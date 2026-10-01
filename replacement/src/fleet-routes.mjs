import {randomUUID} from 'node:crypto';
import {email,text,uuid} from './security.mjs';
export class Problem extends Error {
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
export function mountFleetRoutes({app,pool,requireAuth,route}) {
  async function access(client,workspace,userId,lock=false) {
    if(!uuid(workspace))throw new Problem(404,'NOT_FOUND');
    const result=await client.query('SELECT m.role FROM fleetvera_rebuild.workspaces w JOIN fleetvera_rebuild.memberships m ON m.workspace_id=w.id WHERE w.id=$1 AND m.user_id=$2'+(lock?' FOR UPDATE OF w,m':''),[workspace,userId]);
    if(!result.rowCount)throw new Problem(404,'NOT_FOUND');
    return result.rows[0];
  }
  async function mutate(req,res,roles,action,callback) {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const member=await access(client,req.params.workspaceId,req.user.id,true);
      if(!roles.includes(member.role))throw new Problem(403,'ROLE_REJECTED');
      const result=await callback(client,member);
      await client.query('INSERT INTO fleetvera_rebuild.audit_events(workspace_id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)',[req.params.workspaceId,req.user.id,action,result.id,JSON.stringify(result.audit||{})]);
      await client.query('COMMIT');res.status(result.http||201).json({id:result.id});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  const path='/api/workspaces/:workspaceId';
  app.get(path+'/vehicles',requireAuth,route(async(req,res)=>{
    await access(pool,req.params.workspaceId,req.user.id);
    const result=await pool.query('SELECT id,registration,label,status FROM fleetvera_rebuild.vehicles WHERE workspace_id=$1 ORDER BY registration,id',[req.params.workspaceId]);
    res.json({vehicles:result.rows});
  }));
  app.post(path+'/vehicles',requireAuth,route(async(req,res)=>mutate(req,res,['owner','dispatcher'],'vehicle.created',async client=>{
    const registration=text(req.body?.registration,1,30).toUpperCase().replace(/\s+/g,' '),label=text(req.body?.label,1,120),id=randomUUID();
    await client.query('INSERT INTO fleetvera_rebuild.vehicles(id,workspace_id,registration,label) VALUES($1,$2,$3,$4)',[id,req.params.workspaceId,registration,label]);
    return {id};
  })));
  app.get(path+'/clients',requireAuth,route(async(req,res)=>{
    const member=await access(pool,req.params.workspaceId,req.user.id);
    if(!['owner','dispatcher'].includes(member.role))throw new Problem(403,'ROLE_REJECTED');
    const result=await pool.query('SELECT id,name,contact_email FROM fleetvera_rebuild.clients WHERE workspace_id=$1 ORDER BY name,id',[req.params.workspaceId]);
    res.json({clients:result.rows});
  }));
  app.post(path+'/clients',requireAuth,route(async(req,res)=>mutate(req,res,['owner','dispatcher'],'client.created',async client=>{
    const name=text(req.body?.name,1,120),address=email(req.body?.contactEmail),id=randomUUID();
    await client.query('INSERT INTO fleetvera_rebuild.clients(id,workspace_id,name,contact_email) VALUES($1,$2,$3,$4)',[id,req.params.workspaceId,name,address]);
    return {id};
  })));
}

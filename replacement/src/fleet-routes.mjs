import {randomUUID} from 'node:crypto';
import {email,text,uuid} from './security.mjs';
import {mountMaintenanceRoutes} from './maintenance-routes.mjs';
export class Problem extends Error {
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
export function mountFleetRoutes({app,pool,requireAuth,route}) {
  async function access(client,workspace,userId,lock=false) {
    if(!uuid(workspace))throw new Problem(404,'NOT_FOUND');
    let result=await client.query('SELECT m.role FROM fleetvera_rebuild.workspaces w JOIN fleetvera_rebuild.memberships m ON m.workspace_id=w.id WHERE w.id=$1 AND m.user_id=$2',[workspace,userId]);
    if(!result.rowCount)throw new Problem(404,'NOT_FOUND');
    if(lock){
      // Lock the workspace before any membership so assignment cannot deadlock
      // with a driver's status change; recheck the role after obtaining locks.
      await client.query('SELECT id FROM fleetvera_rebuild.workspaces WHERE id=$1 FOR UPDATE',[workspace]);
      result=await client.query('SELECT role FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE',[workspace,userId]);
      if(!result.rowCount)throw new Problem(404,'NOT_FOUND');
    }
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
  mountMaintenanceRoutes({app,pool,requireAuth,route,access,mutate,Problem});
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
  const deliveryFields='id,client_id,reference,pickup_address,dropoff_address,status,driver_id,vehicle_id,version,started_at,completed_at,cancelled_at';
  function deliveryId(req) {
    if(!uuid(req.params.deliveryId))throw new Problem(404,'NOT_FOUND');
    return req.params.deliveryId;
  }
  function version(req) {
    if(!Number.isSafeInteger(req.body?.expectedVersion)||req.body.expectedVersion<0)throw new Problem(400,'INVALID_INPUT');
    return req.body.expectedVersion;
  }
  async function delivery(client,req,member,lock=false) {
    const restricted=member.role==='driver';
    if(!['owner','dispatcher','driver'].includes(member.role))throw new Problem(403,'ROLE_REJECTED');
    const result=await client.query('SELECT '+deliveryFields+' FROM fleetvera_rebuild.deliveries WHERE workspace_id=$1 AND id=$2'+(restricted?' AND driver_id=$3':'')+(lock?' FOR UPDATE':''),[req.params.workspaceId,deliveryId(req),...(restricted?[req.user.id]:[])]);
    if(!result.rowCount)throw new Problem(404,'NOT_FOUND');
    return result.rows[0];
  }
  app.get(path+'/deliveries',requireAuth,route(async(req,res)=>{
    const member=await access(pool,req.params.workspaceId,req.user.id);
    if(!['owner','dispatcher','driver'].includes(member.role))throw new Problem(403,'ROLE_REJECTED');
    const restricted=member.role==='driver';
    const result=await pool.query('SELECT '+deliveryFields+' FROM fleetvera_rebuild.deliveries WHERE workspace_id=$1'+(restricted?' AND driver_id=$2':'')+' ORDER BY created_at DESC,id',[req.params.workspaceId,...(restricted?[req.user.id]:[])]);
    res.json({deliveries:result.rows});
  }));
  app.get(path+'/deliveries/:deliveryId',requireAuth,route(async(req,res)=>{
    const member=await access(pool,req.params.workspaceId,req.user.id);
    res.json({delivery:await delivery(pool,req,member)});
  }));
  app.post(path+'/deliveries',requireAuth,route(async(req,res)=>mutate(req,res,['owner','dispatcher'],'delivery.created',async client=>{
    if(!uuid(req.body?.clientId))throw new Problem(400,'INVALID_INPUT');
    const customer=await client.query('SELECT id FROM fleetvera_rebuild.clients WHERE workspace_id=$1 AND id=$2',[req.params.workspaceId,req.body.clientId]);
    if(!customer.rowCount)throw new Problem(404,'NOT_FOUND');
    const id=randomUUID(),reference=text(req.body?.reference,1,40).toUpperCase().replace(/\s+/g,' '),pickup=text(req.body?.pickupAddress,1,200),dropoff=text(req.body?.dropoffAddress,1,200);
    await client.query('INSERT INTO fleetvera_rebuild.deliveries(id,workspace_id,client_id,reference,pickup_address,dropoff_address) VALUES($1,$2,$3,$4,$5,$6)',[id,req.params.workspaceId,req.body.clientId,reference,pickup,dropoff]);
    return {id};
  })));
  app.post(path+'/deliveries/:deliveryId/assign',requireAuth,route(async(req,res)=>mutate(req,res,['owner','dispatcher'],'delivery.assigned',async(client,member)=>{
    const current=await delivery(client,req,member,true);
    if(!['planned','assigned'].includes(current.status))throw new Problem(409,'DELIVERY_LOCKED');
    if(current.version!==version(req))throw new Problem(409,'STALE_VERSION');
    const driverId=req.body?.driverId,vehicleId=req.body?.vehicleId;
    if(!uuid(driverId)||!uuid(vehicleId))throw new Problem(400,'INVALID_INPUT');
    const driver=await client.query("SELECT user_id FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND user_id=$2 AND role='driver' FOR UPDATE",[req.params.workspaceId,driverId]);
    const vehicle=await client.query('SELECT status FROM fleetvera_rebuild.vehicles WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[req.params.workspaceId,vehicleId]);
    if(!driver.rowCount||!vehicle.rowCount)throw new Problem(404,'NOT_FOUND');
    if(vehicle.rows[0].status!=='available')throw new Problem(409,'VEHICLE_UNAVAILABLE');
    const busy=await client.query("SELECT id FROM fleetvera_rebuild.deliveries WHERE workspace_id=$1 AND id!=$2 AND status IN ('assigned','in_transit') AND (driver_id=$3 OR vehicle_id=$4)",[req.params.workspaceId,current.id,driverId,vehicleId]);
    if(busy.rowCount)throw new Problem(409,'ASSIGNMENT_BUSY');
    await client.query("UPDATE fleetvera_rebuild.deliveries SET driver_id=$3,vehicle_id=$4,status='assigned',version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[req.params.workspaceId,current.id,driverId,vehicleId]);
    return {id:current.id,http:200,audit:{driverId,vehicleId,previousVersion:current.version}};
  })));
  app.post(path+'/deliveries/:deliveryId/status',requireAuth,route(async(req,res)=>mutate(req,res,['owner','dispatcher','driver'],'delivery.status_changed',async(client,member)=>{
    const current=await delivery(client,req,member,true),next=req.body?.status;
    if(current.version!==version(req))throw new Problem(409,'STALE_VERSION');
    if(!['in_transit','delivered','cancelled'].includes(next))throw new Problem(400,'INVALID_INPUT');
    if(next==='cancelled'&&member.role==='driver')throw new Problem(403,'ROLE_REJECTED');
    const allowed=next==='in_transit'?current.status==='assigned':next==='delivered'?current.status==='in_transit':['planned','assigned','in_transit'].includes(current.status);
    if(!allowed)throw new Problem(409,'STATUS_TRANSITION_REJECTED');
    const timeColumn=next==='in_transit'?'started_at':next==='delivered'?'completed_at':'cancelled_at';
    await client.query('UPDATE fleetvera_rebuild.deliveries SET status=$3,'+timeColumn+'=now(),version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2',[req.params.workspaceId,current.id,next]);
    return {id:current.id,http:200,audit:{from:current.status,to:next,previousVersion:current.version}};
  })));
}

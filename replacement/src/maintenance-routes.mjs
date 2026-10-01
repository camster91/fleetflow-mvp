import {randomUUID} from 'node:crypto';
import {eventDate,text,uuid} from './security.mjs';

export function mountMaintenanceRoutes({app,pool,requireAuth,route,access,mutate,Problem}) {
  const path='/api/workspaces/:workspaceId',roles=['owner','dispatcher','mechanic'];
  const fields='id,vehicle_id,service_type,title,due_on,notes,status,version,cost_cents,currency,started_at,completed_at,cancelled_at';
  app.get(path+'/maintenance',requireAuth,route(async(req,res)=>{
    const member=await access(pool,req.params.workspaceId,req.user.id);
    if(!roles.includes(member.role))throw new Problem(403,'ROLE_REJECTED');
    const result=await pool.query('SELECT '+fields+' FROM fleetvera_rebuild.maintenance WHERE workspace_id=$1 ORDER BY due_on,id',[req.params.workspaceId]);
    res.json({maintenance:result.rows});
  }));
  app.post(path+'/maintenance',requireAuth,route(async(req,res)=>mutate(req,res,roles,'maintenance.created',async client=>{
    if(!uuid(req.body?.vehicleId)||!['inspection','service','repair','other'].includes(req.body?.serviceType))throw new Problem(400,'INVALID_INPUT');
    const vehicle=await client.query('SELECT status FROM fleetvera_rebuild.vehicles WHERE workspace_id=$1 AND id=$2',[req.params.workspaceId,req.body.vehicleId]);
    if(!vehicle.rowCount)throw new Problem(404,'NOT_FOUND');
    if(vehicle.rows[0].status==='retired')throw new Problem(409,'VEHICLE_UNAVAILABLE');
    const id=randomUUID(),title=text(req.body.title,1,160),due=eventDate(req.body.dueOn);
    await client.query('INSERT INTO fleetvera_rebuild.maintenance(id,workspace_id,vehicle_id,service_type,title,due_on) VALUES($1,$2,$3,$4,$5,$6)',[id,req.params.workspaceId,req.body.vehicleId,req.body.serviceType,title,due]);
    return {id};
  })));
  app.post(path+'/maintenance/:maintenanceId/status',requireAuth,route(async(req,res)=>mutate(req,res,roles,'maintenance.status_changed',async client=>{
    if(!uuid(req.params.maintenanceId))throw new Problem(404,'NOT_FOUND');
    if(!Number.isSafeInteger(req.body?.expectedVersion)||req.body.expectedVersion<0)throw new Problem(400,'INVALID_INPUT');
    const result=await client.query('SELECT '+fields+' FROM fleetvera_rebuild.maintenance WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[req.params.workspaceId,req.params.maintenanceId]);
    if(!result.rowCount)throw new Problem(404,'NOT_FOUND');
    const current=result.rows[0],next=req.body.status;
    if(current.version!==req.body.expectedVersion)throw new Problem(409,'STALE_VERSION');
    if(!['in_progress','completed','cancelled'].includes(next))throw new Problem(400,'INVALID_INPUT');
    const allowed=next==='in_progress'?current.status==='planned':next==='completed'?current.status==='in_progress':['planned','in_progress'].includes(current.status);
    if(!allowed)throw new Problem(409,'STATUS_TRANSITION_REJECTED');
    const vehicle=await client.query('SELECT status FROM fleetvera_rebuild.vehicles WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[req.params.workspaceId,current.vehicle_id]);
    if(next==='in_progress'){
      if(vehicle.rows[0].status!=='available')throw new Problem(409,'VEHICLE_UNAVAILABLE');
      const busy=await client.query("SELECT id FROM fleetvera_rebuild.deliveries WHERE workspace_id=$1 AND vehicle_id=$2 AND status IN ('assigned','in_transit')",[req.params.workspaceId,current.vehicle_id]);
      if(busy.rowCount)throw new Problem(409,'DELIVERY_ACTIVE');
      await client.query("UPDATE fleetvera_rebuild.vehicles SET status='maintenance' WHERE workspace_id=$1 AND id=$2",[req.params.workspaceId,current.vehicle_id]);
    }else if(current.status==='in_progress'){
      if(vehicle.rows[0].status!=='maintenance')throw new Problem(409,'VEHICLE_STATE_CHANGED');
      await client.query("UPDATE fleetvera_rebuild.vehicles SET status='available' WHERE workspace_id=$1 AND id=$2",[req.params.workspaceId,current.vehicle_id]);
    }
    const cost=next==='completed'?req.body.costCents:null,currency=next==='completed'?req.body.currency:null;
    if(next==='completed'&&(!Number.isSafeInteger(cost)||cost<0||cost>1000000000||!Intl.supportedValuesOf('currency').includes(currency)))throw new Problem(400,'INVALID_INPUT');
    const notes=text(req.body.notes??'',0,500),timeColumn=next==='in_progress'?'started_at':next==='completed'?'completed_at':'cancelled_at';
    await client.query('UPDATE fleetvera_rebuild.maintenance SET status=$3,'+timeColumn+'=now(),cost_cents=$4,currency=$5,notes=$6,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2',[req.params.workspaceId,current.id,next,cost,currency,notes]);
    return {id:current.id,http:200,audit:{from:current.status,to:next,vehicleId:current.vehicle_id,previousVersion:current.version,...(next==='completed'?{costCents:cost,currency}:{})}};
  })));
  app.get(path+'/reports/operations',requireAuth,route(async(req,res)=>{
    const client=await pool.connect();
    try{
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const member=await access(client,req.params.workspaceId,req.user.id);
      if(!['owner','dispatcher'].includes(member.role))throw new Problem(403,'ROLE_REJECTED');
      const asOf=eventDate(req.query.asOf??new Date().toISOString().slice(0,10)),workspace=req.params.workspaceId;
      const groups={};
      for(const table of ['vehicles','deliveries','maintenance']){
        const result=await client.query('SELECT status,count(*)::integer AS count FROM fleetvera_rebuild.'+table+' WHERE workspace_id=$1 GROUP BY status ORDER BY status',[workspace]);
        groups[table]=Object.fromEntries(result.rows.map(row=>[row.status,row.count]));
      }
      const overdue=await client.query("SELECT count(*)::integer AS count FROM fleetvera_rebuild.maintenance WHERE workspace_id=$1 AND status='planned' AND due_on<$2::date",[workspace,asOf]);
      const costs=await client.query("SELECT currency,sum(cost_cents)::text AS cost_cents FROM fleetvera_rebuild.maintenance WHERE workspace_id=$1 AND status='completed' GROUP BY currency ORDER BY currency",[workspace]);
      await client.query('COMMIT');res.json({asOf,...groups,overdueMaintenance:overdue.rows[0].count,completedMaintenanceCosts:costs.rows});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }));
}

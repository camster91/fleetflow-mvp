import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createApp} from '../src/app.mjs';
import {hashPassword} from '../src/security.mjs';

export async function maintenanceLifecycle(){
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL required');
  assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/fleetvera_rebuild_qa_[a-z0-9_]+$/);
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),workspace=randomUUID(),foreign=randomUUID(),origin='https://maintenance-qa.invalid';
  const app=createApp({pool,origin,revision:'a'.repeat(40)});
  const server=await new Promise(resolve=>{const active=app.listen(0,'127.0.0.1',()=>resolve(active));});
  const base='http://127.0.0.1:'+server.address().port,path='/api/workspaces/'+workspace,accounts={},cookies={};let trigger=false;
  const request=(endpoint,{method='GET',body,role='owner'}={})=>fetch(base+endpoint,{method,headers:{origin,'content-type':'application/json',cookie:cookies[role]||''},...(body?{body:JSON.stringify(body)}:{})});
  const change=(id,status,expectedVersion,extra={},role='mechanic')=>request(path+'/maintenance/'+id+'/status',{method:'POST',body:{status,expectedVersion,...extra},role});
  const list=async()=> (await(await request(path+'/maintenance',{role:'mechanic'})).json()).maintenance;
  const vehicleStatus=async(id)=> (await(await request(path+'/vehicles')).json()).vehicles.find(row=>row.id===id).status;
  async function create(vehicleId,title='QA Service',dueOn='2026-09-01'){
    const response=await request(path+'/maintenance',{method:'POST',role:'mechanic',body:{vehicleId,title,dueOn,serviceType:'service'}});assert.equal(response.status,201);return(await response.json()).id;
  }
  try{
    await pool.query('INSERT INTO fleetvera_rebuild.workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Maintenance QA',foreign,'Foreign QA']);
    const password='QaFixtureOnly-123456',hash=await hashPassword(password);
    for(const role of ['owner','dispatcher','mechanic','driver']){
      const id=randomUUID(),email=role+'-'+workspace+'@example.invalid';accounts[role]=id;
      await pool.query('INSERT INTO fleetvera_rebuild.users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[id,email,'QA '+role,hash]);
      await pool.query('INSERT INTO fleetvera_rebuild.memberships VALUES($1,$2,$3)',[workspace,id,role]);
      const login=await request('/api/auth/login',{method:'POST',body:{email,password}});assert.equal(login.status,200);cookies[role]=login.headers.get('set-cookie').split(';')[0];
    }
    const vehicle=randomUUID(),spare=randomUUID(),foreignVehicle=randomUUID(),clientId=randomUUID(),foreignTask=randomUUID();
    await pool.query('INSERT INTO fleetvera_rebuild.vehicles(id,workspace_id,registration,label) VALUES($1,$2,$3,$4),($5,$2,$6,$7),($8,$9,$10,$11)',[vehicle,workspace,'MAINT-1','QA Van',spare,'MAINT-2','QA Spare',foreignVehicle,foreign,'FOREIGN','Foreign Van']);
    await pool.query('INSERT INTO fleetvera_rebuild.clients(id,workspace_id,name,contact_email) VALUES($1,$2,$3,$4)',[clientId,workspace,'QA Client','qa@example.invalid']);
    await pool.query("INSERT INTO fleetvera_rebuild.maintenance(id,workspace_id,vehicle_id,service_type,title,due_on,status,started_at,completed_at,cost_cents,currency) VALUES($1,$2,$3,'repair','Foreign repair','2000-01-01','completed',now(),now(),99999999,'CAD')",[foreignTask,foreign,foreignVehicle]);
    for(const role of ['driver','mechanic'])assert.equal((await request(path+'/reports/operations',{role})).status,403);
    assert.equal((await request(path+'/maintenance',{role:'driver'})).status,403);
    assert.equal((await request('/api/workspaces/'+foreign+'/reports/operations')).status,404);
    assert.equal((await change(foreignTask,'cancelled',0)).status,404);
    assert.equal((await request(path+'/maintenance',{method:'POST',body:{vehicleId:foreignVehicle,title:'Forbidden',dueOn:'2026-09-01',serviceType:'repair'}})).status,404);
    assert.equal((await request(path+'/maintenance',{method:'POST',body:{vehicleId:vehicle,title:'Bad date',dueOn:'2026-02-30',serviceType:'repair'}})).status,400);
    const id=await create(vehicle);
    assert.equal((await change(id,'completed',0,{costCents:1,currency:'USD'})).status,409);
    assert.equal((await change(id,'in_progress',0,{},'driver')).status,403);
    assert.equal((await change(id,'in_progress',0)).status,200);assert.equal(await vehicleStatus(vehicle),'maintenance');
    assert.equal((await change(id,'completed',0,{costCents:1,currency:'USD'})).status,409);
    assert.equal((await change(id,'completed',1,{costCents:-1,currency:'USD'})).status,400);assert.equal(await vehicleStatus(vehicle),'maintenance');
    const planned=await create(vehicle,'Later service');assert.equal((await change(planned,'cancelled',0)).status,200);assert.equal(await vehicleStatus(vehicle),'maintenance');
    const response=await request(path+'/deliveries',{method:'POST',body:{reference:'MAINT-DELIVERY',clientId,pickupAddress:'QA A',dropoffAddress:'QA B'}});assert.equal(response.status,201);
    const delivery=(await response.json()).id,assign=(vehicleId)=>request(path+'/deliveries/'+delivery+'/assign',{method:'POST',body:{driverId:accounts.driver,vehicleId,expectedVersion:0}});
    assert.equal((await assign(vehicle)).status,409);
    await pool.query("CREATE FUNCTION fleetvera_rebuild.qa_reject_maintenance_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA audit failure'; END $$");
    await pool.query("CREATE TRIGGER qa_maintenance_audit_failure BEFORE INSERT ON fleetvera_rebuild.audit_events FOR EACH ROW WHEN (NEW.action='maintenance.status_changed') EXECUTE FUNCTION fleetvera_rebuild.qa_reject_maintenance_audit()");trigger=true;
    assert.equal((await change(id,'completed',1,{costCents:12345,currency:'USD'})).status,503);
    assert.equal(await vehicleStatus(vehicle),'maintenance');const rolledBack=(await list()).find(row=>row.id===id);assert.equal(rolledBack.status,'in_progress');assert.equal(rolledBack.version,1);assert.equal(rolledBack.cost_cents,null);
    await pool.query('DROP TRIGGER qa_maintenance_audit_failure ON fleetvera_rebuild.audit_events');await pool.query('DROP FUNCTION fleetvera_rebuild.qa_reject_maintenance_audit()');trigger=false;
    assert.equal((await change(id,'completed',1,{costCents:12345,currency:'USD',notes:'QA repair completed'})).status,200);assert.equal(await vehicleStatus(vehicle),'available');
    assert.equal((await change(id,'cancelled',2)).status,409);
    const raceMaintenance=await create(spare,'Race service'),race=await Promise.all([change(raceMaintenance,'in_progress',0),assign(spare)]);
    assert.deepEqual(race.map(result=>result.status).sort(),[200,409]);
    if(race[1].status===200){
      assert.equal((await change(raceMaintenance,'in_progress',0)).status,409);
      assert.equal((await request(path+'/deliveries/'+delivery+'/status',{method:'POST',body:{status:'cancelled',expectedVersion:1}})).status,200);
      assert.equal((await change(raceMaintenance,'in_progress',0)).status,200);
    }
    assert.equal((await change(raceMaintenance,'completed',1,{costCents:500,currency:'CAD'})).status,200);assert.equal(await vehicleStatus(spare),'available');
    await create(spare,'Overdue planned service','2026-09-30');
    const reportResponse=await request(path+'/reports/operations?asOf=2026-10-01',{role:'dispatcher'});assert.equal(reportResponse.status,200);
    const report=await reportResponse.json();assert.equal(report.vehicles.available,2);assert.equal(report.maintenance.completed,2);assert.equal(report.maintenance.cancelled,1);assert.equal(report.maintenance.planned,1);assert.equal(report.overdueMaintenance,1);
    assert.deepEqual(report.completedMaintenanceCosts,[{currency:'CAD',cost_cents:'500'},{currency:'USD',cost_cents:'12345'}]);
    assert.equal((await request(path+'/reports/operations?asOf=2026-02-30')).status,400);
    assert.equal((await(await request(path+'/reports/operations?asOf=2026-09-29')).json()).overdueMaintenance,0);
    const events=await pool.query('SELECT action FROM fleetvera_rebuild.audit_events WHERE workspace_id=$1 AND target_id=$2 ORDER BY id',[workspace,id]);assert.deepEqual(events.rows.map(row=>row.action),['maintenance.created','maintenance.status_changed','maintenance.status_changed']);
    const completed=(await list()).find(row=>row.id===id);assert(completed.started_at&&completed.completed_at);assert.equal(completed.notes,'QA repair completed');
  }finally{
    if(trigger){await pool.query('DROP TRIGGER IF EXISTS qa_maintenance_audit_failure ON fleetvera_rebuild.audit_events');await pool.query('DROP FUNCTION IF EXISTS fleetvera_rebuild.qa_reject_maintenance_audit()');}
    await new Promise(resolve=>server.close(resolve));await pool.end();
  }
}

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createApp} from '../src/app.mjs';
import {hashPassword} from '../src/security.mjs';

export async function deliveryLifecycle(){
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL is required');
  assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/fleetvera_rebuild_qa_[a-z0-9_]+$/);
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),workspace=randomUUID(),foreign=randomUUID();
  const origin='https://fleetvera-delivery-qa.invalid',fixturePassword='QaFixtureOnly-123456';
  const app=createApp({pool,origin,revision:'a'.repeat(40)});
  const server=await new Promise(resolve=>{const active=app.listen(0,'127.0.0.1',()=>resolve(active));});
  const base='http://127.0.0.1:'+server.address().port,path='/api/workspaces/'+workspace;
  const accounts={},cookies={};let trigger=false;
  async function request(endpoint,{method='GET',body,role='owner'}={}){
    return fetch(base+endpoint,{method,headers:{origin,'content-type':'application/json',cookie:cookies[role]||''},...(body?{body:JSON.stringify(body)}:{})});
  }
  async function create(reference,clientId){
    const response=await request(path+'/deliveries',{method:'POST',body:{reference,clientId,pickupAddress:'QA Warehouse',dropoffAddress:'QA Destination'}});
    assert.equal(response.status,201);return (await response.json()).id;
  }
  const assign=(id,body,role='owner')=>request(path+'/deliveries/'+id+'/assign',{method:'POST',body,role});
  const change=(id,status,expectedVersion,role='driver')=>request(path+'/deliveries/'+id+'/status',{method:'POST',body:{status,expectedVersion},role});
  try{
    await pool.query('INSERT INTO fleetvera_rebuild.workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Delivery QA Fleet',foreign,'Foreign Fleet']);
    const hash=await hashPassword(fixturePassword);
    for(const role of ['owner','dispatcher','driver','otherDriver','mechanic','foreignDriver']){
      const id=randomUUID(),address=role.toLowerCase()+'-'+workspace+'@example.invalid';accounts[role]=id;
      await pool.query('INSERT INTO fleetvera_rebuild.users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[id,address,'QA '+role,hash]);
      const membership=role==='otherDriver'||role==='foreignDriver'?'driver':role;
      await pool.query('INSERT INTO fleetvera_rebuild.memberships(workspace_id,user_id,role) VALUES($1,$2,$3)',[role==='foreignDriver'?foreign:workspace,id,membership]);
      const login=await request('/api/auth/login',{method:'POST',body:{email:address,password:fixturePassword}});assert.equal(login.status,200);
      cookies[role]=login.headers.get('set-cookie').split(';')[0];
    }
    const customer=randomUUID(),foreignCustomer=randomUUID(),vehicle=randomUUID(),foreignVehicle=randomUUID(),maintenanceVehicle=randomUUID();
    await pool.query('INSERT INTO fleetvera_rebuild.clients(id,workspace_id,name,contact_email) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',[customer,workspace,'QA Client','private@example.invalid',foreignCustomer,foreign,'Foreign Client','foreign@example.invalid']);
    await pool.query('INSERT INTO fleetvera_rebuild.vehicles(id,workspace_id,registration,label,status) VALUES($1,$2,$3,$4,$5),($6,$2,$7,$8,$9),($10,$11,$12,$13,$5)',[vehicle,workspace,'DELIVERY-VAN','QA Van','available',maintenanceVehicle,'SHOP-VAN','QA Maintenance','maintenance',foreignVehicle,foreign,'FOREIGN-VAN','Foreign Van']);
    const invalid=await request(path+'/deliveries',{method:'POST',body:{reference:'foreign',clientId:foreignCustomer,pickupAddress:'A',dropoffAddress:'B'}});assert.equal(invalid.status,404);
    assert.equal((await request(path+'/deliveries',{method:'POST',role:'driver',body:{reference:'driver-created',clientId:customer,pickupAddress:'A',dropoffAddress:'B'}})).status,403);
    assert.equal((await request(path+'/deliveries',{role:'mechanic'})).status,403);
    const id=await create(' delivery-1 ',customer);
    assert.equal((await change(id,'in_transit',0,'owner')).status,409);
    assert.equal((await assign(id,{driverId:accounts.foreignDriver,vehicleId:vehicle,expectedVersion:0})).status,404);
    assert.equal((await assign(id,{driverId:accounts.driver,vehicleId:foreignVehicle,expectedVersion:0})).status,404);
    assert.equal((await assign(id,{driverId:accounts.driver,vehicleId:maintenanceVehicle,expectedVersion:0})).status,409);
    assert.equal((await assign(id,{driverId:accounts.owner,vehicleId:vehicle,expectedVersion:0})).status,404);
    assert.equal((await assign(id,{driverId:accounts.driver,vehicleId:vehicle,expectedVersion:0},'driver')).status,403);
    assert.equal((await assign(id,{driverId:accounts.driver,vehicleId:vehicle,expectedVersion:0},'dispatcher')).status,200);
    assert.equal((await request(path+'/deliveries/'+id,{role:'otherDriver'})).status,404);
    assert.equal((await request('/api/workspaces/'+foreign+'/deliveries/'+id)).status,404);
    const own=await (await request(path+'/deliveries',{role:'driver'})).json();assert.equal(own.deliveries.length,1);assert.equal(own.deliveries[0].reference,'DELIVERY-1');
    assert(!JSON.stringify(own).includes('private@example.invalid'));
    assert.deepEqual((await (await request(path+'/deliveries',{role:'otherDriver'})).json()).deliveries,[]);
    assert.equal((await change(id,'delivered',1)).status,409);
    assert.equal((await change(id,'cancelled',1)).status,403);
    assert.equal((await change(id,'in_transit',0)).status,409);
    assert.equal((await change(id,'in_transit',1,'otherDriver')).status,404);
    const queued=await create('delivery-2',customer);
    assert.equal((await assign(queued,{driverId:accounts.otherDriver,vehicleId:vehicle,expectedVersion:0})).status,409);
    await pool.query("CREATE FUNCTION fleetvera_rebuild.qa_reject_delivery_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA audit failure'; END $$");
    await pool.query("CREATE TRIGGER qa_delivery_audit_failure BEFORE INSERT ON fleetvera_rebuild.audit_events FOR EACH ROW WHEN (NEW.action='delivery.status_changed') EXECUTE FUNCTION fleetvera_rebuild.qa_reject_delivery_audit()");trigger=true;
    assert.equal((await change(id,'in_transit',1)).status,503);
    const unchanged=await (await request(path+'/deliveries/'+id)).json();assert.equal(unchanged.delivery.status,'assigned');assert.equal(unchanged.delivery.version,1);
    await pool.query('DROP TRIGGER qa_delivery_audit_failure ON fleetvera_rebuild.audit_events');await pool.query('DROP FUNCTION fleetvera_rebuild.qa_reject_delivery_audit()');trigger=false;
    assert.equal((await change(id,'in_transit',1)).status,200);
    assert.equal((await assign(id,{driverId:accounts.otherDriver,vehicleId:vehicle,expectedVersion:2})).status,409);
    assert.equal((await change(id,'delivered',2)).status,200);
    const completed=await (await request(path+'/deliveries/'+id,{role:'driver'})).json();assert.equal(completed.delivery.status,'delivered');assert(completed.delivery.started_at&&completed.delivery.completed_at);assert.equal(completed.delivery.version,3);
    assert.equal((await change(id,'cancelled',3,'owner')).status,409);
    assert.equal((await change(id,'in_transit',3)).status,409);
    const third=await create('delivery-3',customer);
    const competing=await Promise.all([assign(queued,{driverId:accounts.driver,vehicleId:vehicle,expectedVersion:0}),assign(third,{driverId:accounts.otherDriver,vehicleId:vehicle,expectedVersion:0})]);
    assert.deepEqual(competing.map(response=>response.status).sort(),[200,409]);
    const winner=competing[0].status===200?queued:third;
    assert.equal((await change(winner,'cancelled',1,'owner')).status,200);
    const available=await create('delivery-4',customer);
    assert.equal((await assign(available,{driverId:accounts.driver,vehicleId:vehicle,expectedVersion:0})).status,200);
    const assignmentVsStart=await Promise.all([
      assign(available,{driverId:accounts.otherDriver,vehicleId:vehicle,expectedVersion:1}),
      change(available,'in_transit',1,'driver')
    ]);
    const concurrentStatuses=assignmentVsStart.map(response=>response.status);
    assert.equal(concurrentStatuses.filter(status=>status===200).length,1);
    assert(concurrentStatuses.every(status=>[200,404,409].includes(status)),'Competing actor locks must not deadlock');
    assert.equal((await change(available,'cancelled',2,'owner')).status,200);
    const spareResponse=await request(path+'/vehicles',{method:'POST',body:{registration:'DRIVER-TEST',label:'QA Spare'}});assert.equal(spareResponse.status,201);
    const spare=(await spareResponse.json()).id,slotOne=await create('driver-slot-1',customer),slotTwo=await create('driver-slot-2',customer);
    assert.equal((await assign(slotOne,{driverId:accounts.driver,vehicleId:vehicle,expectedVersion:0})).status,200);
    assert.equal((await assign(slotTwo,{driverId:accounts.driver,vehicleId:spare,expectedVersion:0})).status,409);
    assert.equal((await change(slotOne,'cancelled',1,'owner')).status,200);
    const audit=await pool.query('SELECT action,details FROM fleetvera_rebuild.audit_events WHERE workspace_id=$1 AND target_id=$2 ORDER BY id',[workspace,id]);
    assert.deepEqual(audit.rows.map(row=>row.action),['delivery.created','delivery.assigned','delivery.status_changed','delivery.status_changed']);
    assert.deepEqual(audit.rows.slice(2).map(row=>[row.details.from,row.details.to]),[['assigned','in_transit'],['in_transit','delivered']]);
  }finally{
    if(trigger){await pool.query('DROP TRIGGER IF EXISTS qa_delivery_audit_failure ON fleetvera_rebuild.audit_events');await pool.query('DROP FUNCTION IF EXISTS fleetvera_rebuild.qa_reject_delivery_audit()');}
    await new Promise(resolve=>server.close(resolve));await pool.end();
  }
}

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createApp} from '../src/app.mjs';
import {hashPassword,tokenHash} from '../src/security.mjs';
export async function teamLifecycle(){
  assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/fleetvera_rebuild_qa_[a-z0-9_]+$/);
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),origin='https://team-qa.invalid';
  const server=await new Promise(resolve=>{const active=createApp({pool,origin,revision:'b'.repeat(40)}).listen(0,'127.0.0.1',()=>resolve(active));});
  const base='http://127.0.0.1:'+server.address().port,workspace=randomUUID(),foreign=randomUUID(),owner=randomUUID(),pass='QaTeamOnly-123456789';
  async function req(path,{cookie,body,method=body?'POST':'GET',requestOrigin=origin}={}){
    return fetch(base+path,{method,headers:{origin:requestOrigin,'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  }
  async function login(address,p=pass){const response=await req('/api/auth/login',{body:{email:address,password:p}});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
  const path='/api/workspaces/'+workspace;
  try{
    await pool.query('INSERT INTO fleetvera_rebuild.workspaces(id,name) VALUES($1,$2),($3,$4)',[workspace,'Team QA',foreign,'Foreign Team QA']);
    await pool.query('INSERT INTO fleetvera_rebuild.users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[owner,'team-owner@example.invalid','Owner',await hashPassword(pass)]);
    await pool.query("INSERT INTO fleetvera_rebuild.memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspace,owner]);
    const ownerCookie=await login('team-owner@example.invalid');
    assert.equal((await req('/api/workspaces',{body:{name:'No auth'}})).status,401);
    assert.equal((await req(path,{cookie:ownerCookie,body:{name:'Renamed Team'}})).status,200);
    const extra=await req('/api/workspaces',{cookie:ownerCookie,body:{name:'Second Team'}});assert.equal(extra.status,201);
    const second=(await extra.json()).id;
    assert.equal((await req('/api/workspaces/'+second+'/members',{cookie:ownerCookie})).status,200);
    assert.equal((await req('/api/workspaces/'+foreign+'/members',{cookie:ownerCookie})).status,404);
    assert.equal((await req(path+'/members/'+owner,{cookie:ownerCookie,body:{role:'driver',revoked:false,expectedVersion:0}})).status,409);
    async function invite(address,role='driver'){
      const response=await req(path+'/invitations',{cookie:ownerCookie,body:{email:address,role}});assert.equal(response.status,201);return response.json();
    }
    async function accept(invitation,address,p=pass){return req('/api/auth/invitations/accept',{body:{token:invitation.token,email:address,password:p,name:'Invited QA'}});}
    const first=await invite('team-driver@example.invalid');
    const stored=await pool.query('SELECT token_hash FROM fleetvera_rebuild.invitations WHERE id=$1',[first.id]);assert.equal(stored.rows[0].token_hash,tokenHash(first.token));assert.notEqual(stored.rows[0].token_hash,first.token);
    assert.equal((await accept(first,'wrong@example.invalid')).status,403);
    assert.equal((await req('/api/auth/invitations/accept',{body:{token:first.token,email:'team-driver@example.invalid',password:pass,name:'QA'},requestOrigin:'https://foreign.invalid'})).status,403);
    const accepted=await accept(first,'team-driver@example.invalid');assert.equal(accepted.status,200);const driverCookie=accepted.headers.get('set-cookie').split(';')[0];
    const driver=(await (await req('/api/me',{cookie:driverCookie})).json()).user.id;
    assert.equal((await accept(first,'team-driver@example.invalid')).status,403);
    assert.equal((await req(path+'/members',{cookie:driverCookie})).status,403);
    assert.equal((await req(path+'/invitations',{cookie:driverCookie,body:{email:'forbidden@example.invalid',role:'owner'}})).status,403);
    assert.equal((await req(path,{cookie:driverCookie,body:{name:'Forbidden'}})).status,403);
    const revoked=await invite('revoked-team@example.invalid');
    assert.equal((await req('/api/workspaces/'+foreign+'/invitations/'+revoked.id+'/revoke',{cookie:ownerCookie,body:{}})).status,404);
    assert.equal((await req(path+'/invitations/'+revoked.id+'/revoke',{cookie:ownerCookie,body:{}})).status,200);
    assert.equal((await accept(revoked,'revoked-team@example.invalid')).status,403);
    const expired=await invite('expired-team@example.invalid');await pool.query("UPDATE fleetvera_rebuild.invitations SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
    assert.equal((await accept(expired,'expired-team@example.invalid')).status,403);
    const superseded=await invite('new-link@example.invalid'),current=await invite('new-link@example.invalid');
    assert.equal((await accept(superseded,'new-link@example.invalid')).status,403);
    const races=await Promise.all([accept(current,'new-link@example.invalid'),accept(current,'new-link@example.invalid')]);assert.deepEqual(races.map(r=>r.status).sort(),[200,403]);
    // Existing accounts must prove their existing password; invite cannot overwrite it.
    const existing=await req('/api/workspaces/'+second+'/invitations',{cookie:ownerCookie,body:{email:'team-driver@example.invalid',role:'mechanic'}});assert.equal(existing.status,201);
    const existingInvite=await existing.json();assert.equal((await accept(existingInvite,'team-driver@example.invalid','WrongExistingPass-123456')).status,403);
    assert.equal((await accept(existingInvite,'team-driver@example.invalid')).status,200);
    const vehicle=randomUUID(),client=randomUUID(),delivery=randomUUID();
    await pool.query('INSERT INTO fleetvera_rebuild.vehicles(id,workspace_id,registration,label) VALUES($1,$2,$3,$4)',[vehicle,workspace,'TEAM-QA','Team Van']);
    await pool.query('INSERT INTO fleetvera_rebuild.clients(id,workspace_id,name,contact_email) VALUES($1,$2,$3,$4)',[client,workspace,'Team Client','client@example.invalid']);
    await pool.query("INSERT INTO fleetvera_rebuild.deliveries(id,workspace_id,client_id,reference,pickup_address,dropoff_address,status,driver_id,vehicle_id) VALUES($1,$2,$3,'TEAM-QA','A','B','assigned',$4,$5)",[delivery,workspace,client,driver,vehicle]);
    const change={role:'mechanic',revoked:true,expectedVersion:0};
    assert.equal((await req(path+'/members/'+driver,{cookie:ownerCookie,body:change})).status,409);
    await pool.query("UPDATE fleetvera_rebuild.deliveries SET status='cancelled',cancelled_at=now() WHERE id=$1",[delivery]);
    // Failed audit must preserve membership and existing session access.
    await pool.query("CREATE FUNCTION fleetvera_rebuild.fail_team_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='membership.changed' THEN RAISE EXCEPTION 'QA team audit failure'; END IF; RETURN NEW; END $$");
    await pool.query('CREATE TRIGGER qa_team_audit BEFORE INSERT ON fleetvera_rebuild.audit_events FOR EACH ROW EXECUTE FUNCTION fleetvera_rebuild.fail_team_audit()');
    assert.equal((await req(path+'/members/'+driver,{cookie:ownerCookie,body:change})).status,503);
    assert.equal((await req(path+'/vehicles',{cookie:driverCookie})).status,200);
    await pool.query('DROP TRIGGER qa_team_audit ON fleetvera_rebuild.audit_events');await pool.query('DROP FUNCTION fleetvera_rebuild.fail_team_audit()');
    assert.equal((await req(path+'/members/'+driver,{cookie:ownerCookie,body:change})).status,200);
    assert.equal((await req(path+'/vehicles',{cookie:driverCookie})).status,404);
    const me=await (await req('/api/me',{cookie:driverCookie})).json();assert.equal(me.workspaces.some(w=>w.id===workspace),false);assert.equal(me.workspaces.some(w=>w.id===second),true);
    assert.equal((await req(path+'/members/'+driver,{cookie:ownerCookie,body:{...change,revoked:false}})).status,409);
    const back=await invite('team-driver@example.invalid');assert.equal((await accept(back,'team-driver@example.invalid')).status,200);
    assert.equal((await req(path+'/vehicles',{cookie:driverCookie})).status,200);
    const preserved=await pool.query('SELECT driver_id FROM fleetvera_rebuild.deliveries WHERE id=$1',[delivery]);assert.equal(preserved.rows[0].driver_id,driver);
    const raceDeliveryResponse=await req(path+'/deliveries',{cookie:ownerCookie,body:{clientId:client,reference:'ROLE-RACE',pickupAddress:'A',dropoffAddress:'B'}});assert.equal(raceDeliveryResponse.status,201);const raceDelivery=(await raceDeliveryResponse.json()).id;
    const assignmentRace=await Promise.all([
      req(path+'/deliveries/'+raceDelivery+'/assign',{cookie:ownerCookie,body:{driverId:driver,vehicleId:vehicle,expectedVersion:0}}),
      req(path+'/members/'+driver,{cookie:ownerCookie,body:{role:'mechanic',revoked:true,expectedVersion:2}})
    ]);
    assert.equal(assignmentRace.filter(r=>r.status===200).length,1);assert.ok(assignmentRace.every(r=>[200,404,409].includes(r.status)));
    const driverState=(await pool.query('SELECT role,revoked_at FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND user_id=$2',[workspace,driver])).rows[0];
    const deliveryState=(await pool.query('SELECT status FROM fleetvera_rebuild.deliveries WHERE id=$1',[raceDelivery])).rows[0];
    if(deliveryState.status==='assigned'){assert.equal(driverState.role,'driver');assert.equal(driverState.revoked_at,null);}
    else{assert.equal(deliveryState.status,'planned');assert.ok(driverState.revoked_at);assert.equal((await req(path+'/vehicles',{cookie:driverCookie})).status,404);}
    const co=await invite('co-owner@example.invalid','owner'),coResponse=await accept(co,'co-owner@example.invalid');assert.equal(coResponse.status,200);
    const coCookie=coResponse.headers.get('set-cookie').split(';')[0],coId=(await (await req('/api/me',{cookie:coCookie})).json()).user.id;
    const pendingOwner=await invite('pending-owner@example.invalid');
    const pendingCoResponse=await req(path+'/invitations',{cookie:coCookie,body:{email:'pending-co@example.invalid',role:'driver'}});assert.equal(pendingCoResponse.status,201);const pendingCo=await pendingCoResponse.json();
    const removals=await Promise.all([req(path+'/members/'+owner,{cookie:ownerCookie,body:{role:'driver',revoked:false,expectedVersion:0}}),req(path+'/members/'+coId,{cookie:coCookie,body:{role:'driver',revoked:false,expectedVersion:0}})]);
    assert.deepEqual(removals.map(r=>r.status).sort(),[200,409]);
    const ownerCount=await pool.query("SELECT count(*)::integer AS count FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND role='owner' AND revoked_at IS NULL",[workspace]);assert.equal(ownerCount.rows[0].count,1);
    // Invitations from demoted owners cannot grant access.
    const ownerRole=(await pool.query('SELECT role FROM fleetvera_rebuild.memberships WHERE workspace_id=$1 AND user_id=$2',[workspace,owner])).rows[0].role;
    assert.equal((await accept(ownerRole==='owner'?pendingCo:pendingOwner,ownerRole==='owner'?'pending-co@example.invalid':'pending-owner@example.invalid')).status,403);
  }finally{
    await pool.query('DROP TRIGGER IF EXISTS qa_team_audit ON fleetvera_rebuild.audit_events');await pool.query('DROP FUNCTION IF EXISTS fleetvera_rebuild.fail_team_audit()');
    await new Promise(resolve=>server.close(resolve));await pool.end();
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createApp} from '../src/app.mjs';
import {hashPassword} from '../src/security.mjs';
import {deliveryLifecycle} from './delivery-qa.mjs';
import {maintenanceLifecycle} from './maintenance-qa.mjs';
import {teamLifecycle} from './team-qa.mjs';

test('Fresh Fleetvera owner, authentication, workspace isolation and vehicle/client roles',async()=>{
  const connection=process.env.DATABASE_URL;
  assert.ok(connection,'Disposable PostgreSQL is required; this test must not skip');
  assert.match(new URL(connection).pathname,/^\/fleetvera_rebuild_qa_[a-z0-9_]+$/);
  const pool=new pg.Pool({connectionString:connection});
  const origin='https://fleetvera-qa.invalid',setupToken='qa-token-not-for-production-'.repeat(3),revision='a'.repeat(40);
  const app=createApp({pool,origin,setupToken,revision});
  const server=await new Promise(resolve=>{const active=app.listen(0,'127.0.0.1',()=>resolve(active));});
  const base='http://127.0.0.1:'+server.address().port;
  const fixture={email:'owner@example.invalid',name:'QA Owner',workspace:'QA Fleet',password:'QaFixtureOnly-123456',setupToken};
  async function request(path,{method='GET',body,cookie,requestOrigin=origin}={}){
    return fetch(base+path,{method,headers:{origin:requestOrigin,'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  }
  try {
    assert.equal((await request('/api/me')).status,401);
    assert.equal((await request('/api/auth/bootstrap',{method:'POST',body:fixture,requestOrigin:'https://foreign.invalid'})).status,403);
    assert.equal((await request('/api/auth/bootstrap',{method:'POST',body:{...fixture,setupToken:'wrong'}})).status,403);
    const setup=await request('/api/auth/bootstrap',{method:'POST',body:fixture});assert.equal(setup.status,201);
    const {workspaceId}=await setup.json();const session=setup.headers.get('set-cookie');
    assert.match(session,/HttpOnly/);assert.match(session,/Secure/);assert.match(session,/SameSite=Strict/);
    const cookie=session.split(';')[0];
    assert.equal((await request('/api/auth/bootstrap',{method:'POST',body:fixture})).status,409);
    assert.equal((await request('/api/auth/login',{method:'POST',body:{email:fixture.email,password:'WrongPasswordOnly-123456'}})).status,401);
    const me=await request('/api/me',{cookie});assert.equal(me.status,200);assert.equal((await me.json()).workspaces[0].role,'owner');
    const path='/api/workspaces/'+workspaceId;
    const vehicleBody={registration:' ab-123 ',label:'QA Van'};
    const vehicle=await request(path+'/vehicles',{method:'POST',body:vehicleBody,cookie});assert.equal(vehicle.status,201);
    assert.equal((await request(path+'/vehicles',{method:'POST',body:vehicleBody,cookie})).status,409);
    const vehicles=await (await request(path+'/vehicles',{cookie})).json();assert.equal(vehicles.vehicles.length,1);assert.equal(vehicles.vehicles[0].registration,'AB-123');
    assert.equal((await request(path+'/clients',{method:'POST',body:{name:'QA Client',contactEmail:'Contact@Example.Invalid'},cookie})).status,201);
    const clients=await (await request(path+'/clients',{cookie})).json();assert.equal(clients.clients[0].contact_email,'contact@example.invalid');
    const foreignId=randomUUID(),foreignUser=randomUUID(),driver=randomUUID();
    const hash=await hashPassword(fixture.password);
    await pool.query('INSERT INTO fleetvera_rebuild.workspaces(id,name) VALUES($1,$2)',[foreignId,'Foreign Fleet']);
    for(const [id,address] of [[foreignUser,'foreign@example.invalid'],[driver,'driver@example.invalid']])await pool.query('INSERT INTO fleetvera_rebuild.users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[id,address,'QA fixture',hash]);
    await pool.query("INSERT INTO fleetvera_rebuild.memberships(workspace_id,user_id,role) VALUES($1,$2,'owner'),($3,$4,'driver')",[foreignId,foreignUser,workspaceId,driver]);
    assert.equal((await request('/api/workspaces/'+foreignId+'/vehicles',{cookie})).status,404);
    assert.equal((await request('/api/workspaces/'+foreignId+'/clients',{method:'POST',body:{name:'Forbidden',contactEmail:'blocked@example.invalid'},cookie})).status,404);
    const login=await request('/api/auth/login',{method:'POST',body:{email:'driver@example.invalid',password:fixture.password}});assert.equal(login.status,200);
    const driverCookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await request(path+'/vehicles',{cookie:driverCookie})).status,200);
    assert.equal((await request(path+'/vehicles',{method:'POST',body:vehicleBody,cookie:driverCookie})).status,403);
    assert.equal((await request(path+'/clients',{cookie:driverCookie})).status,403);
    assert.equal((await request(path+'/clients',{method:'POST',body:{name:'Forbidden',contactEmail:'blocked@example.invalid'},cookie:driverCookie})).status,403);
    assert.equal((await request(path+'/vehicles',{method:'POST',body:{...vehicleBody,registration:'NEW'},cookie,requestOrigin:'https://foreign.invalid'})).status,403);
    const audit=await pool.query('SELECT action FROM fleetvera_rebuild.audit_events ORDER BY id');assert.deepEqual(audit.rows.map(row=>row.action),['workspace.created','vehicle.created','client.created']);
    const health=await (await request('/api/health/ready')).json();assert.equal(health.revision,revision);assert.equal(health.database,'ok');
    assert.equal((await request('/api/auth/logout',{method:'POST',cookie})).status,200);
    assert.equal((await request('/api/me',{cookie})).status,401);
  }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});

// Top-level tests in this file run sequentially: bootstrap needs an empty DB
// before the delivery fixtures intentionally add their separate workspaces.
test('Delivery lifecycle, scoped assignments, driver access, concurrency and transactional audit',deliveryLifecycle);
test('Maintenance lifecycle, vehicle dispatch interlock, scoped reports and audit rollback',maintenanceLifecycle);
test('Team invitations, workspace administration, access revocation and last-owner races',teamLifecycle);

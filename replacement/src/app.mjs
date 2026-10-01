import { mountFleetRoutes, Problem } from './fleet-routes.mjs';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID } from 'node:crypto';
import { email, eventDate, hashPassword, password, secretMatches, text, tokenHash, uuid, verifyPassword } from './security.mjs';

export function createApp({ pool, origin, setupToken, revision, secureCookies = true }) {
  if (new URL(origin).origin !== origin || (secureCookies && !origin.startsWith('https://'))) throw new Error('Canonical origin required');
  const app = express();
  app.locals.canonicalOrigin=origin;
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== origin) return res.status(403).json({ error: 'ORIGIN_REJECTED' });
    next();
  });
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));
  const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  function cookie(res, value, maxAge) {
    res.cookie('fleetvera_rebuild_session', value, { httpOnly: true, secure: secureCookies, sameSite: 'strict', path: '/', maxAge });
  }
  function sessionToken(req) {
    return (req.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith('fleetvera_rebuild_session='))?.slice('fleetvera_rebuild_session='.length) || '';
  }
  async function issueSession(client, res, userId) {
    const token = randomBytes(32).toString('hex');
    await client.query("INSERT INTO fleetvera_rebuild.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')", [tokenHash(token), userId]);
    cookie(res, token, 12 * 60 * 60 * 1000);
  }
  const requireAuth = (req, res, next) => {
    const token = sessionToken(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    pool.query('SELECT u.id,u.email,u.display_name FROM fleetvera_rebuild.sessions s JOIN fleetvera_rebuild.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [tokenHash(token)])
      .then(result => { if (!result.rowCount) return res.status(401).json({ error: 'AUTH_REQUIRED' }); req.user=result.rows[0]; next(); }).catch(next);
  };
  app.get('/api/health/ready', route(async (_req, res) => {
    const result=await pool.query('SELECT version FROM public.fleetvera_rebuild_migrations ORDER BY version');
    if(result.rows.map(row=>row.version).join(',')!=='1,2,3,4')throw new Error('Required migration missing');
    res.json({ status: 'ok', database: 'ok', revision });
  }));
  app.post('/api/auth/bootstrap', route(async (req, res) => {
    if (!setupToken || setupToken.length < 32 || !secretMatches(req.body?.setupToken, setupToken)) return res.status(403).json({ error: 'SETUP_REJECTED' });
    const address=email(req.body.email), name=text(req.body.name,1,100), workspace=text(req.body.workspace,1,120);
    const hash=await hashPassword(password(req.body.password));
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(829404)');
      if ((await client.query('SELECT 1 FROM fleetvera_rebuild.users LIMIT 1')).rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'SETUP_COMPLETE' }); }
      const userId=randomUUID(), workspaceId=randomUUID();
      await client.query('INSERT INTO fleetvera_rebuild.users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',[userId,address,name,hash]);
      await client.query('INSERT INTO fleetvera_rebuild.workspaces(id,name) VALUES($1,$2)',[workspaceId,workspace]);
      await client.query("INSERT INTO fleetvera_rebuild.memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspaceId,userId]);
      await client.query("INSERT INTO fleetvera_rebuild.audit_events(workspace_id,actor_id,action,target_id) VALUES($1,$2,'workspace.created',$1)",[workspaceId,userId]);
      await issueSession(client,res,userId);
      await client.query('COMMIT');
      res.status(201).json({ workspaceId });
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }));
  app.post('/api/auth/login', route(async (req,res) => {
    const address=email(req.body?.email), candidate=password(req.body?.password);
    const result=await pool.query('SELECT id,password_hash FROM fleetvera_rebuild.users WHERE email=$1',[address]);
    // A valid-cost dummy hash keeps unknown accounts on the same scrypt path.
    const stored=result.rows[0]?.password_hash || 'scrypt1:'+ '0'.repeat(32)+':'+ '0'.repeat(128);
    if (!await verifyPassword(candidate,stored) || !result.rowCount) return res.status(401).json({ error: 'LOGIN_REJECTED' });
    await issueSession(pool,res,result.rows[0].id);
    res.json({ status: 'ok' });
  }));
  app.post('/api/auth/logout', requireAuth, route(async(req,res) => {
    await pool.query('DELETE FROM fleetvera_rebuild.sessions WHERE token_hash=$1',[tokenHash(sessionToken(req))]);
    cookie(res,'',0);res.json({ status:'ok' });
  }));
  app.get('/api/me', requireAuth, route(async(req,res) => {
    const memberships=await pool.query('SELECT o.id,o.name,m.role FROM fleetvera_rebuild.memberships m JOIN fleetvera_rebuild.workspaces o ON o.id=m.workspace_id WHERE m.user_id=$1 AND m.revoked_at IS NULL ORDER BY o.name',[req.user.id]);
    res.json({ user:req.user, workspaces:memberships.rows });
  }));
  mountFleetRoutes({app,pool,requireAuth,route,issueSession});
  app.use((_req,res)=>res.status(404).json({error:'NOT_FOUND'}));
  app.use((error,_req,res,_next)=>{
    if(error instanceof Problem)return res.status(error.status).json({error:error.code});
    if(error.code==='23505')return res.status(409).json({error:'CONFLICT'});
    if(error.code==='23503')return res.status(404).json({error:'NOT_FOUND'});
    const invalid=error.message.startsWith('Invalid')||error.message.startsWith('Password')||error.type==='entity.parse.failed';
    res.status(invalid?400:503).json({error:invalid?'INVALID_INPUT':'REQUEST_UNAVAILABLE'});
  });
  return app;
}

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

const REPORTS_KEY = 'saved_reports';

/** Stored in user.notificationPreferences JSON under key 'saved_reports' */
async function getReports(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { notificationPreferences: true },
  });
  const prefs = user?.notificationPreferences ? JSON.parse(user.notificationPreferences) : {};
  return (prefs[REPORTS_KEY] ?? []) as SavedReport[];
}

async function saveReports(userId: string, reports: SavedReport[]) {
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { notificationPreferences: true },
  });
  const prefs = user?.notificationPreferences ? JSON.parse(user.notificationPreferences) : {};
  prefs[REPORTS_KEY] = reports;
  await prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: JSON.stringify(prefs) },
  });
}

interface SavedReport {
  id: string;
  name: string;
  type: string;
  schedule: string;
  format: string;
  createdAt: string;
  lastRun?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const reports = await getReports(userId);
      return res.json({ reports });
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      return res.status(500).json({ error: 'Failed to fetch reports' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, type, schedule, format } = req.body;
      if (!name || !type || !schedule || !format) {
        return res.status(400).json({ error: 'name, type, schedule, format required' });
      }
      const reports = await getReports(userId);
      const newReport: SavedReport = {
        id: `rpt_${Date.now()}`,
        name,
        type,
        schedule,
        format,
        createdAt: new Date().toISOString(),
      };
      reports.push(newReport);
      await saveReports(userId, reports);
      return res.status(201).json({ report: newReport });
    } catch (err) {
      console.error('Failed to create report:', err);
      return res.status(500).json({ error: 'Failed to create report' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const reports = await getReports(userId);
      const filtered = reports.filter(r => r.id !== id);
      if (filtered.length === reports.length) return res.status(404).json({ error: 'Report not found' });
      await saveReports(userId, filtered);
      return res.json({ success: true });
    } catch (err) {
      console.error('Failed to delete report:', err);
      return res.status(500).json({ error: 'Failed to delete report' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const reports = await getReports(userId);
      const idx = reports.findIndex(r => r.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Report not found' });
      reports[idx] = { ...reports[idx], ...updates };
      await saveReports(userId, reports);
      return res.json({ report: reports[idx] });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update report' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}

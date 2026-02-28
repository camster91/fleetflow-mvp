// Server-side email utilities
// Use these in API routes and server functions

import { sendEmail, sendBulkEmail, APP_URL, FROM_EMAIL } from '../services/emailService'
import * as templates from '../services/emailTemplates'

// Re-export for convenience
export { sendEmail, sendBulkEmail, APP_URL, FROM_EMAIL, templates }

// Helper to send vehicle-related emails
export async function notifyVehicleAdded(vehicle: any, addedBy: string, recipientEmails: string[]) {
  const { html, text } = templates.vehicleAddedEmail(vehicle, addedBy)
  
  return sendBulkEmail(recipientEmails, `New Vehicle Added: ${vehicle.name}`, html, text)
}

// Helper to send maintenance notifications
export async function notifyMaintenanceDue(vehicle: any, tasks: string[], recipientEmails: string[]) {
  const { html, text } = templates.maintenanceDueEmail(vehicle, tasks)
  
  return sendBulkEmail(
    recipientEmails, 
    `🔧 Maintenance Due: ${vehicle.name}`, 
    html, 
    text
  )
}

// Helper to send delivery assignment
export async function notifyDeliveryAssigned(
  delivery: any, 
  driverName: string, 
  driverEmail: string,
  assignedBy: string
) {
  const { html, text } = templates.deliveryAssignedEmail(delivery, driverName, assignedBy)
  
  return sendEmail({
    to: driverEmail,
    subject: `New Delivery Assignment: ${delivery.customer}`,
    html,
    text
  })
}

// Helper to send delivery status updates
export async function notifyDeliveryStatus(
  delivery: any,
  recipientEmails: string[],
  recipientType: 'customer' | 'admin' = 'admin'
) {
  const { html, text } = templates.deliveryStatusUpdateEmail(delivery, recipientType)
  
  return sendBulkEmail(
    recipientEmails,
    `Delivery Update: ${delivery.customer} - ${delivery.status}`,
    html,
    text
  )
}

// Helper to send daily reports
export async function sendDailyReport(report: any, recipientEmails: string[]) {
  const { html, text } = templates.dailyReportEmail(report)
  
  return sendBulkEmail(
    recipientEmails,
    `Daily Fleet Report - ${new Date(report.date).toLocaleDateString()}`,
    html,
    text
  )
}

// Helper to send announcements
export async function sendAnnouncement(
  announcement: { message: string; priority: 'low' | 'normal' | 'high' | 'urgent'; sentBy?: string },
  recipientEmails: string[]
) {
  const { html, text } = templates.announcementEmail(announcement)
  
  return sendBulkEmail(
    recipientEmails,
    `Fleet Announcement - ${announcement.priority.toUpperCase()}`,
    html,
    text
  )
}

// Helper to send welcome email
export async function sendWelcomeEmail(userName: string, userEmail: string, loginUrl: string) {
  const { html, text } = templates.welcomeEmail(userName, loginUrl)
  
  return sendEmail({
    to: userEmail,
    subject: 'Welcome to FleetFlow!',
    html,
    text
  })
}

// Helper to send password reset
export async function sendPasswordReset(email: string, resetUrl: string) {
  const { html, text } = templates.passwordResetEmail(resetUrl)
  
  return sendEmail({
    to: email,
    subject: 'Password Reset Request',
    html,
    text
  })
}

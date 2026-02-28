// Email Templates for FleetFlow
// All templates return HTML and plain text versions

import { APP_URL } from './emailService'

// Brand colors
const BRAND = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280',
  lightGray: '#F3F4F6'
}

// Base email layout wrapper
function wrapEmail(content: string, title: string): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background: #F3F4F6; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .footer { background: ${BRAND.lightGray}; padding: 20px; text-align: center; font-size: 12px; color: ${BRAND.gray}; }
    .button { display: inline-block; background: ${BRAND.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .button:hover { background: ${BRAND.primaryDark}; }
    .alert { padding: 16px; border-radius: 6px; margin: 16px 0; }
    .alert-success { background: #D1FAE5; border-left: 4px solid ${BRAND.success}; }
    .alert-warning { background: #FEF3C7; border-left: 4px solid ${BRAND.warning}; }
    .alert-danger { background: #FEE2E2; border-left: 4px solid ${BRAND.danger}; }
    .card { background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin: 16px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: ${BRAND.gray}; font-size: 14px; }
    .value { font-weight: 600; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 20px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚛 FleetFlow</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>FleetFlow Fleet Management System</p>
      <p><a href="${APP_URL}">${APP_URL}</a></p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`

  // Generate plain text version by stripping HTML
  const text = content
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { html, text }
}

// ==================== AUTHENTICATION EMAILS ====================

export function welcomeEmail(userName: string, loginUrl: string) {
  const content = `
    <h2>Welcome to FleetFlow, ${userName}!</h2>
    <p>Your account has been successfully created. FleetFlow helps you manage your fleet operations efficiently.</p>
    
    <div class="alert alert-success">
      <strong>✓ Account Created Successfully</strong>
    </div>
    
    <p>You can now log in to access your dashboard:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" class="button">Log In to FleetFlow</a>
    </p>
    
    <div class="card">
      <h3>Getting Started</h3>
      <ul>
        <li>View and manage your vehicles</li>
        <li>Track deliveries in real-time</li>
        <li>Schedule maintenance tasks</li>
        <li>Manage client information</li>
      </ul>
    </div>
    
    <p>If you have any questions, contact your fleet administrator.</p>
  `
  return wrapEmail(content, 'Welcome to FleetFlow')
}

export function passwordResetEmail(resetUrl: string, expiresIn: string = '1 hour') {
  const content = `
    <h2>Password Reset Request</h2>
    <p>We received a request to reset your FleetFlow password.</p>
    
    <div class="alert alert-warning">
      <strong>⚠ This link expires in ${expiresIn}</strong>
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    
    <p>Or copy and paste this link:</p>
    <p style="word-break: break-all; background: #F3F4F6; padding: 10px; border-radius: 4px;">${resetUrl}</p>
    
    <p>If you didn't request this reset, please ignore this email or contact your administrator.</p>
  `
  return wrapEmail(content, 'Password Reset Request')
}

// ==================== VEHICLE EMAILS ====================

export function vehicleAddedEmail(vehicle: {
  name: string
  type?: string
  driver?: string
  licensePlate?: string
}, addedBy: string) {
  const content = `
    <h2>New Vehicle Added</h2>
    <p>A new vehicle has been added to the fleet by ${addedBy}.</p>
    
    <div class="card">
      <h3>Vehicle Details</h3>
      <div class="detail-row">
        <span class="label">Vehicle Name</span>
        <span class="value">${vehicle.name}</span>
      </div>
      ${vehicle.type ? `
      <div class="detail-row">
        <span class="label">Type</span>
        <span class="value">${vehicle.type}</span>
      </div>
      ` : ''}
      ${vehicle.driver ? `
      <div class="detail-row">
        <span class="label">Driver</span>
        <span class="value">${vehicle.driver}</span>
      </div>
      ` : ''}
      ${vehicle.licensePlate ? `
      <div class="detail-row">
        <span class="label">License Plate</span>
        <span class="value">${vehicle.licensePlate}</span>
      </div>
      ` : ''}
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=vehicles" class="button">View Vehicles</a>
    </p>
  `
  return wrapEmail(content, 'New Vehicle Added')
}

export function maintenanceDueEmail(vehicle: {
  name: string
  mileage?: number
  nextService?: string
}, tasks: string[]) {
  const content = `
    <h2>🔧 Maintenance Due</h2>
    <div class="alert alert-warning">
      <strong>Maintenance is due for ${vehicle.name}</strong>
    </div>
    
    <div class="card">
      <h3>Vehicle Information</h3>
      <div class="detail-row">
        <span class="label">Vehicle</span>
        <span class="value">${vehicle.name}</span>
      </div>
      ${vehicle.mileage ? `
      <div class="detail-row">
        <span class="label">Current Mileage</span>
        <span class="value">${vehicle.mileage.toLocaleString()} mi</span>
      </div>
      ` : ''}
      ${vehicle.nextService ? `
      <div class="detail-row">
        <span class="label">Service Due</span>
        <span class="value">${vehicle.nextService}</span>
      </div>
      ` : ''}
    </div>
    
    <div class="card">
      <h3>Required Maintenance</h3>
      <ul>
        ${tasks.map(task => `<li>${task}</li>`).join('')}
      </ul>
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=maintenance" class="button">View Maintenance</a>
    </p>
  `
  return wrapEmail(content, 'Maintenance Due')
}

// ==================== DELIVERY EMAILS ====================

export function deliveryAssignedEmail(delivery: {
  id: number
  customer: string
  address: string
  items: number
  scheduledTime?: string
}, driverName: string, assignedBy: string) {
  const content = `
    <h2>📦 New Delivery Assignment</h2>
    <p>Hello ${driverName},</p>
    <p>You have been assigned a new delivery by ${assignedBy}.</p>
    
    <div class="card">
      <h3>Delivery Details</h3>
      <div class="detail-row">
        <span class="label">Customer</span>
        <span class="value">${delivery.customer}</span>
      </div>
      <div class="detail-row">
        <span class="label">Address</span>
        <span class="value">${delivery.address}</span>
      </div>
      <div class="detail-row">
        <span class="label">Items</span>
        <span class="value">${delivery.items}</span>
      </div>
      ${delivery.scheduledTime ? `
      <div class="detail-row">
        <span class="label">Scheduled</span>
        <span class="value">${new Date(delivery.scheduledTime).toLocaleString()}</span>
      </div>
      ` : ''}
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=deliveries" class="button">View Delivery</a>
    </p>
    
    <p>Please update the delivery status as you progress.</p>
  `
  return wrapEmail(content, 'New Delivery Assignment')
}

export function deliveryStatusUpdateEmail(delivery: {
  id: number
  customer: string
  status: string
  progress: number
  driver: string
}, recipientType: 'customer' | 'admin') {
  const statusColors: Record<string, string> = {
    'pending': BRAND.warning,
    'in-transit': BRAND.primary,
    'delivered': BRAND.success,
    'cancelled': BRAND.danger
  }
  
  const statusMessages: Record<string, string> = {
    'pending': 'Your delivery is pending and will be dispatched soon.',
    'in-transit': 'Your delivery is on the way!',
    'delivered': 'Your delivery has been completed.',
    'cancelled': 'Your delivery has been cancelled.'
  }
  
  const content = `
    <h2>📦 Delivery Update</h2>
    
    <div class="alert" style="background: ${statusColors[delivery.status]}20; border-left-color: ${statusColors[delivery.status]};">
      <strong>Status: ${delivery.status.toUpperCase()}</strong>
      <p>${statusMessages[delivery.status]}</p>
    </div>
    
    <div class="card">
      <h3>Delivery Information</h3>
      <div class="detail-row">
        <span class="label">Customer</span>
        <span class="value">${delivery.customer}</span>
      </div>
      <div class="detail-row">
        <span class="label">Driver</span>
        <span class="value">${delivery.driver}</span>
      </div>
      <div class="detail-row">
        <span class="label">Progress</span>
        <span class="value">${delivery.progress}%</span>
      </div>
    </div>
    
    ${recipientType === 'customer' ? `
    <p>Track your delivery in real-time:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/track/${delivery.id}" class="button">Track Delivery</a>
    </p>
    ` : `
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=deliveries" class="button">View All Deliveries</a>
    </p>
    `}
  `
  return wrapEmail(content, 'Delivery Status Update')
}

export function deliveryCompletedEmail(delivery: {
  customer: string
  address: string
  completedTime?: string
  driver: string
}, proofPhoto?: string) {
  const content = `
    <h2>✅ Delivery Completed</h2>
    <div class="alert alert-success">
      <strong>Your delivery has been successfully completed!</strong>
    </div>
    
    <div class="card">
      <h3>Delivery Details</h3>
      <div class="detail-row">
        <span class="label">Customer</span>
        <span class="value">${delivery.customer}</span>
      </div>
      <div class="detail-row">
        <span class="label">Address</span>
        <span class="value">${delivery.address}</span>
      </div>
      <div class="detail-row">
        <span class="label">Driver</span>
        <span class="value">${delivery.driver}</span>
      </div>
      ${delivery.completedTime ? `
      <div class="detail-row">
        <span class="label">Completed At</span>
        <span class="value">${new Date(delivery.completedTime).toLocaleString()}</span>
      </div>
      ` : ''}
    </div>
    
    ${proofPhoto ? `
    <p>Proof of delivery photo:</p>
    <img src="${proofPhoto}" alt="Delivery Photo" style="max-width: 100%; border-radius: 8px; margin: 16px 0;">
    ` : ''}
    
    <p>Thank you for using FleetFlow!</p>
  `
  return wrapEmail(content, 'Delivery Completed')
}

// ==================== MAINTENANCE EMAILS ====================

export function maintenanceTaskCreatedEmail(task: {
  vehicle: string
  type: string
  dueDate: string
  priority: string
  estimatedDuration?: string
}, createdBy: string) {
  const priorityColors: Record<string, string> = {
    'high': BRAND.danger,
    'medium': BRAND.warning,
    'low': BRAND.success
  }
  
  const content = `
    <h2>🔧 New Maintenance Task</h2>
    <p>A new maintenance task has been created by ${createdBy}.</p>
    
    <div class="card">
      <h3>Task Details</h3>
      <div class="detail-row">
        <span class="label">Vehicle</span>
        <span class="value">${task.vehicle}</span>
      </div>
      <div class="detail-row">
        <span class="label">Maintenance Type</span>
        <span class="value">${task.type}</span>
      </div>
      <div class="detail-row">
        <span class="label">Due Date</span>
        <span class="value">${new Date(task.dueDate).toLocaleDateString()}</span>
      </div>
      <div class="detail-row">
        <span class="label">Priority</span>
        <span class="value" style="color: ${priorityColors[task.priority]};">${task.priority.toUpperCase()}</span>
      </div>
      ${task.estimatedDuration ? `
      <div class="detail-row">
        <span class="label">Estimated Duration</span>
        <span class="value">${task.estimatedDuration}</span>
      </div>
      ` : ''}
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=maintenance" class="button">View Maintenance</a>
    </p>
  `
  return wrapEmail(content, 'New Maintenance Task')
}

export function maintenanceOverdueEmail(tasks: Array<{
  vehicle: string
  type: string
  dueDate: string
  daysOverdue: number
}>) {
  const content = `
    <h2>⚠️ Maintenance Overdue</h2>
    <div class="alert alert-danger">
      <strong>${tasks.length} maintenance task${tasks.length > 1 ? 's are' : ' is'} overdue!</strong>
    </div>
    
    <div class="card">
      <h3>Overdue Tasks</h3>
      ${tasks.map(task => `
        <div style="padding: 12px; border-bottom: 1px solid #E5E7EB;">
          <strong>${task.vehicle}</strong> - ${task.type}<br>
          <span style="color: ${BRAND.danger}; font-size: 14px;">
            Due: ${new Date(task.dueDate).toLocaleDateString()} (${task.daysOverdue} days overdue)
          </span>
        </div>
      `).join('')}
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=maintenance" class="button">View Maintenance</a>
    </p>
  `
  return wrapEmail(content, 'Maintenance Overdue')
}

// ==================== CLIENT EMAILS ====================

export function clientWelcomeEmail(clientName: string, businessName?: string) {
  const displayName = businessName || clientName
  
  const content = `
    <h2>Welcome to FleetFlow Delivery Services</h2>
    <p>Dear ${clientName},</p>
    <p>Thank you for choosing FleetFlow for your delivery needs. ${businessName ? `${businessName} is` : 'You are'} now registered in our system.</p>
    
    <div class="card">
      <h3>What to Expect</h3>
      <ul>
        <li>Real-time delivery tracking</li>
        <li>Email notifications for delivery status</li>
        <li>Professional drivers and vehicles</li>
        <li>Proof of delivery with photos</li>
        <li>Easy scheduling and communication</li>
      </ul>
    </div>
    
    <p>We'll notify you when your deliveries are scheduled and provide updates throughout the delivery process.</p>
    
    <p>If you have any questions, please don't hesitate to contact us.</p>
  `
  return wrapEmail(content, 'Welcome to FleetFlow')
}

// ==================== ANNOUNCEMENT EMAILS ====================

export function announcementEmail(announcement: {
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  sentBy?: string
}, recipientName?: string) {
  const priorityColors: Record<string, string> = {
    'low': BRAND.success,
    'normal': BRAND.primary,
    'high': BRAND.warning,
    'urgent': BRAND.danger
  }
  
  const priorityBg: Record<string, string> = {
    'low': '#D1FAE5',
    'normal': '#DBEAFE',
    'high': '#FEF3C7',
    'urgent': '#FEE2E2'
  }
  
  const content = `
    <h2>📢 Fleet Announcement</h2>
    
    <div class="alert" style="background: ${priorityBg[announcement.priority]}; border-left-color: ${priorityColors[announcement.priority]};">
      <strong>Priority: ${announcement.priority.toUpperCase()}</strong>
    </div>
    
    ${recipientName ? `<p>Hello ${recipientName},</p>` : ''}
    
    <div class="card">
      <p style="font-size: 16px; line-height: 1.8;">${announcement.message.replace(/\n/g, '<br>')}</p>
    </div>
    
    ${announcement.sentBy ? `<p style="color: ${BRAND.gray}; font-size: 14px;">Sent by: ${announcement.sentBy}</p>` : ''}
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}" class="button">Open FleetFlow</a>
    </p>
  `
  return wrapEmail(content, `Fleet Announcement - ${announcement.priority.toUpperCase()}`)
}

// ==================== REPORT EMAILS ====================

export function dailyReportEmail(report: {
  date: string
  totalDeliveries: number
  completedDeliveries: number
  pendingDeliveries: number
  activeVehicles: number
  maintenanceTasks: number
  alerts: string[]
}) {
  const content = `
    <h2>📊 Daily Fleet Report</h2>
    <p>Report for ${new Date(report.date).toLocaleDateString()}</p>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;">
      <div class="card" style="text-align: center; margin: 0;">
        <div style="font-size: 32px; font-weight: bold; color: ${BRAND.primary};">${report.totalDeliveries}</div>
        <div style="color: ${BRAND.gray};">Total Deliveries</div>
      </div>
      <div class="card" style="text-align: center; margin: 0;">
        <div style="font-size: 32px; font-weight: bold; color: ${BRAND.success};">${report.completedDeliveries}</div>
        <div style="color: ${BRAND.gray};">Completed</div>
      </div>
      <div class="card" style="text-align: center; margin: 0;">
        <div style="font-size: 32px; font-weight: bold; color: ${BRAND.warning};">${report.activeVehicles}</div>
        <div style="color: ${BRAND.gray};">Active Vehicles</div>
      </div>
      <div class="card" style="text-align: center; margin: 0;">
        <div style="font-size: 32px; font-weight: bold; color: ${BRAND.danger};">${report.maintenanceTasks}</div>
        <div style="color: ${BRAND.gray};">Maintenance Due</div>
      </div>
    </div>
    
    ${report.alerts.length > 0 ? `
    <div class="alert alert-warning">
      <h4>⚠️ Alerts</h4>
      <ul>
        ${report.alerts.map(alert => `<li>${alert}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=reports" class="button">View Full Report</a>
    </p>
  `
  return wrapEmail(content, 'Daily Fleet Report')
}

// ==================== VENDING MACHINE EMAILS ====================

export function vendingMachineAlertEmail(machine: {
  name: string
  location: string
  status: string
  openNotes: number
}) {
  const statusMessages: Record<string, string> = {
    'needs-restock': 'This machine needs to be restocked.',
    'needs-maintenance': 'This machine requires maintenance.',
    'offline': 'This machine is currently offline.'
  }
  
  const content = `
    <h2>🚨 Vending Machine Alert</h2>
    <div class="alert alert-warning">
      <strong>${machine.name} requires attention</strong>
    </div>
    
    <div class="card">
      <h3>Machine Details</h3>
      <div class="detail-row">
        <span class="label">Location</span>
        <span class="value">${machine.name}</span>
      </div>
      <div class="detail-row">
        <span class="label">Address</span>
        <span class="value">${machine.location}</span>
      </div>
      <div class="detail-row">
        <span class="label">Status</span>
        <span class="value">${machine.status.replace('-', ' ').toUpperCase()}</span>
      </div>
      ${machine.openNotes > 0 ? `
      <div class="detail-row">
        <span class="label">Open Notes</span>
        <span class="value">${machine.openNotes}</span>
      </div>
      ` : ''}
    </div>
    
    <p>${statusMessages[machine.status] || 'Please check this machine.'}</p>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=vending" class="button">View Machine</a>
    </p>
  `
  return wrapEmail(content, 'Vending Machine Alert')
}

// ==================== SUMMARY/NEWSLETTER EMAILS ====================

export function weeklySummaryEmail(data: {
  weekOf: string
  deliveriesCompleted: number
  newClients: number
  maintenanceCompleted: number
  topDriver?: string
  fleetUtilization: number
}) {
  const content = `
    <h2>📈 Weekly Fleet Summary</h2>
    <p>Week of ${new Date(data.weekOf).toLocaleDateString()}</p>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;">
      <div class="card" style="text-align: center; margin: 0;">
        <div style="font-size: 32px; font-weight: bold; color: ${BRAND.success};">${data.deliveriesCompleted}</div>
        <div style="color: ${BRAND.gray};">Deliveries Completed</div>
      </div>
      <div class="card" style="text-align: center; margin: 0;">
        <div style="font-size: 32px; font-weight: bold; color: ${BRAND.primary};">${data.newClients}</div>
        <div style="color: ${BRAND.gray};">New Clients</div>
      </div>
      <div class="card" style="text-align: center; margin: 0;">
        <div style="font-size: 32px; font-weight: bold; color: ${BRAND.warning};">${data.maintenanceCompleted}</div>
        <div style="color: ${BRAND.gray};">Maintenance Tasks</div>
      </div>
      <div class="card" style="text-align: center; margin: 0;">
        <div style="font-size: 32px; font-weight: bold; color: ${BRAND.primary};">${data.fleetUtilization}%</div>
        <div style="color: ${BRAND.gray};">Fleet Utilization</div>
      </div>
    </div>
    
    ${data.topDriver ? `
    <div class="card" style="text-align: center; background: linear-gradient(135deg, ${BRAND.primary}10, ${BRAND.primary}20);">
      <h3>🏆 Driver of the Week</h3>
      <p style="font-size: 24px; font-weight: bold; color: ${BRAND.primary}; margin: 8px 0;">${data.topDriver}</p>
    </div>
    ` : ''}
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}?tab=reports" class="button">View Full Report</a>
    </p>
  `
  return wrapEmail(content, 'Weekly Fleet Summary')
}

export { BRAND }

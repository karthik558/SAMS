/**
 * Email Templates for SAMS
 * Professional, responsive HTML email templates with SAMS branding
 */

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Base email wrapper with SAMS branding
 */
function wrapTemplate(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>SAMS Notification</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #3a3a3a;
      background-color: #f8f9fa;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f8f9fa;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 16px rgba(204, 124, 94, 0.08);
    }
    .email-header {
      background-color: #cc7c5e;
      color: #ffffff;
      padding: 40px;
      text-align: center;
    }
    .logo-container {
      margin-bottom: 20px;
    }
    .logo {
      max-width: 80px;
      height: auto;
    }
    .email-header h1 {
      margin: 0 0 8px 0;
      font-size: 32px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    .email-header p {
      margin: 0;
      font-size: 14px;
      opacity: 0.95;
      font-weight: 400;
    }
    .email-body {
      padding: 40px;
    }
    .email-body h2 {
      color: #2c3e50;
      font-size: 22px;
      font-weight: 600;
      margin: 0 0 24px 0;
      letter-spacing: -0.3px;
    }
    .email-body p {
      color: #5a6c7d;
      font-size: 15px;
      line-height: 1.7;
      margin: 0 0 16px 0;
    }
    .info-box {
      background-color: #f8f9fa;
      border-left: 3px solid #cc7c5e;
      padding: 20px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 10px 0;
      font-size: 14px;
      color: #5a6c7d;
    }
    .info-box p:first-child {
      margin-top: 0;
    }
    .info-box p:last-child {
      margin-bottom: 0;
    }
    .info-box strong {
      color: #2c3e50;
      font-weight: 600;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #cc7c5e;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      margin: 24px 0;
      text-align: center;
      transition: background-color 0.2s ease;
    }
    .button:hover {
      background-color: #d68b70;
    }
    .success-box {
      background-color: #d4edda;
      border-left-color: #28a745;
    }
    .warning-box {
      background-color: #fff3cd;
      border-left-color: #ffc107;
    }
    .error-box {
      background-color: #f8d7da;
      border-left-color: #dc3545;
    }
    .divider {
      height: 1px;
      background-color: #e9ecef;
      margin: 32px 0;
    }
    .email-footer {
      background-color: #2c3e50;
      color: #ffffff;
      padding: 40px;
      text-align: center;
    }
    .email-footer p {
      color: #b4bcc8;
      font-size: 13px;
      margin: 8px 0;
      line-height: 1.6;
    }
    .email-footer strong {
      color: #ffffff;
      font-weight: 600;
    }
    .email-footer a {
      color: #cc7c5e;
      text-decoration: none;
      transition: color 0.2s ease;
    }
    .email-footer a:hover {
      color: #d68b70;
    }
    .footer-links {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      .email-body {
        padding: 30px 24px;
      }
      .email-header {
        padding: 32px 24px;
      }
      .email-footer {
        padding: 32px 24px;
      }
      .button {
        display: block;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <div class="logo-container">
          <img src="https://raw.githubusercontent.com/karthik558/SAMS/main/public/sams_logo.png" alt="SAMS Logo" class="logo" />
        </div>
        <h1>SAMS</h1>
        <p>Smart Asset Management System</p>
      </div>
      ${content}
      <div class="email-footer">
        <p><strong>SAMS</strong> — Smart Asset Management System</p>
        <p>Centralized asset lifecycle tracking with QR-enabled workflows and audit-ready reporting</p>
        <div class="footer-links">
          <p>
            <a href="https://samsproject.in">Visit Website</a> • 
            <a href="https://github.com/karthik558/SAMS">GitHub</a> • 
            <a href="mailto:karthik@samsproject.in">Contact Support</a>
          </p>
          <p style="margin-top: 16px; font-size: 12px;">
            This is an automated notification from SAMS. Please do not reply to this email.
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ====================
// APPROVAL TEMPLATES
// ====================

export function approvalSubmittedTemplate(data: {
  requesterName: string;
  assetName: string;
  action: string;
  notes?: string;
  approvalId: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `New Approval Request: ${data.action} - ${data.assetName}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>New Approval Request</h2>
      <p>Hello,</p>
      <p><strong>${data.requesterName}</strong> has submitted a new approval request that requires your review.</p>
      
      <div class="info-box">
        <p><strong>Request ID:</strong> ${data.approvalId}</p>
        <p><strong>Action:</strong> ${data.action}</p>
        <p><strong>Asset:</strong> ${data.assetName}</p>
        ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
      </div>
      
      <p>Please review and take appropriate action.</p>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/approvals" class="button">Review Request</a>
    </div>
  `, `${data.requesterName} submitted an approval request for ${data.assetName}`);
  
  const text = `
New Approval Request

${data.requesterName} has submitted a new approval request.

Request ID: ${data.approvalId}
Action: ${data.action}
Asset: ${data.assetName}
${data.notes ? `Notes: ${data.notes}` : ''}

Review: ${data.dashboardUrl || 'https://samsproject.in'}/approvals
  `.trim();
  
  return { subject, html, text };
}

export function approvalForwardedTemplate(data: {
  managerName: string;
  assetName: string;
  action: string;
  notes?: string;
  approvalId: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `Approval Forwarded: ${data.action} - ${data.assetName}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>Approval Forwarded to Admin</h2>
      <p>Hello,</p>
      <p><strong>${data.managerName}</strong> has forwarded an approval request to you for final decision.</p>
      
      <div class="warning-box">
        <p><strong>Request ID:</strong> ${data.approvalId}</p>
        <p><strong>Action:</strong> ${data.action}</p>
        <p><strong>Asset:</strong> ${data.assetName}</p>
        ${data.notes ? `<p><strong>Manager Notes:</strong> ${data.notes}</p>` : ''}
      </div>
      
      <p>Your approval is required to proceed with this request.</p>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/approvals" class="button">Review & Decide</a>
    </div>
  `, `${data.managerName} forwarded approval for ${data.assetName}`);
  
  const text = `
Approval Forwarded to Admin

${data.managerName} has forwarded an approval request.

Request ID: ${data.approvalId}
Action: ${data.action}
Asset: ${data.assetName}
${data.notes ? `Manager Notes: ${data.notes}` : ''}

Review: ${data.dashboardUrl || 'https://samsproject.in'}/approvals
  `.trim();
  
  return { subject, html, text };
}

export function approvalApprovedTemplate(data: {
  approverName: string;
  requesterEmail: string;
  assetName: string;
  action: string;
  notes?: string;
  approvalId: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `Approval Approved: ${data.assetName}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>Request Approved</h2>
      <p>Great news!</p>
      <p>Your approval request for <strong>${data.assetName}</strong> has been approved by <strong>${data.approverName}</strong>.</p>
      
      <div class="success-box">
        <p><strong>Request ID:</strong> ${data.approvalId}</p>
        <p><strong>Action:</strong> ${data.action}</p>
        <p><strong>Status:</strong> Approved</p>
        ${data.notes ? `<p><strong>Comments:</strong> ${data.notes}</p>` : ''}
      </div>
      
      <p>You can now proceed with your planned action.</p>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/assets" class="button">View Asset</a>
    </div>
  `, `Your approval request for ${data.assetName} has been approved`);
  
  const text = `
Request Approved

Your approval request for ${data.assetName} has been approved by ${data.approverName}.

Request ID: ${data.approvalId}
Action: ${data.action}
Status: Approved
${data.notes ? `Comments: ${data.notes}` : ''}

View Asset: ${data.dashboardUrl || 'https://samsproject.in'}/assets
  `.trim();
  
  return { subject, html, text };
}

export function approvalRejectedTemplate(data: {
  approverName: string;
  requesterEmail: string;
  assetName: string;
  action: string;
  notes?: string;
  approvalId: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `Approval Rejected: ${data.assetName}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>Request Rejected</h2>
      <p>Hello,</p>
      <p>Your approval request for <strong>${data.assetName}</strong> has been rejected by <strong>${data.approverName}</strong>.</p>
      
      <div class="error-box">
        <p><strong>Request ID:</strong> ${data.approvalId}</p>
        <p><strong>Action:</strong> ${data.action}</p>
        <p><strong>Status:</strong> Rejected</p>
        ${data.notes ? `<p><strong>Reason:</strong> ${data.notes}</p>` : ''}
      </div>
      
      <p>Please review the feedback and consider resubmitting your request if needed.</p>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/approvals" class="button">View Details</a>
    </div>
  `, `Your approval request for ${data.assetName} has been rejected`);
  
  const text = `
Request Rejected

Your approval request for ${data.assetName} has been rejected by ${data.approverName}.

Request ID: ${data.approvalId}
Action: ${data.action}
Status: Rejected
${data.notes ? `Reason: ${data.notes}` : ''}

View Details: ${data.dashboardUrl || 'https://samsproject.in'}/approvals
  `.trim();
  
  return { subject, html, text };
}

// ====================
// NEWSLETTER TEMPLATES
// ====================

export function newsletterPublishedTemplate(data: {
  title: string;
  body: string;
  category: string;
  author?: string;
  publishedAt: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `New Update: ${data.title}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>New Newsletter</h2>
      
      <div class="info-box">
        <p><strong>${data.title}</strong></p>
        <p style="font-size: 13px; color: #6c757d;">
          ${data.author ? `By ${data.author} • ` : ''}${new Date(data.publishedAt).toLocaleDateString()}
          ${data.category ? ` • ${data.category}` : ''}
        </p>
      </div>
      
      <div style="margin: 20px 0;">
        ${data.body}
      </div>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/newsletter" class="button">Read Full Update</a>
      
      <div class="divider"></div>
      
      <p style="font-size: 12px; color: #6c757d;">
        You're receiving this because you're subscribed to SAMS newsletters.
      </p>
    </div>
  `, `New update: ${data.title}`);
  
  const text = `
New Newsletter: ${data.title}

Category: ${data.category}
${data.author ? `Author: ${data.author}` : ''}
Date: ${new Date(data.publishedAt).toLocaleDateString()}

${data.body}

Read more: ${data.dashboardUrl || 'https://samsproject.in'}/newsletter
  `.trim();
  
  return { subject, html, text };
}

// ====================
// TICKET TEMPLATES
// ====================

export function ticketAssignedTemplate(data: {
  ticketId: string;
  title: string;
  description?: string;
  priority: string;
  assetName?: string;
  assignedBy: string;
  assignedTo: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `Ticket Assigned: ${data.title}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>New Ticket Assigned</h2>
      <p>Hello,</p>
      <p>A new ticket has been assigned to you by <strong>${data.assignedBy}</strong>.</p>
      
      <div class="info-box">
        <p><strong>Ticket ID:</strong> ${data.ticketId}</p>
        <p><strong>Title:</strong> ${data.title}</p>
        <p><strong>Priority:</strong> ${data.priority}</p>
        ${data.assetName ? `<p><strong>Asset:</strong> ${data.assetName}</p>` : ''}
        ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
      </div>
      
      <p>Please review and take necessary action.</p>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/tickets" class="button">View Ticket</a>
    </div>
  `, `New ticket assigned: ${data.title}`);
  
  const text = `
New Ticket Assigned

A new ticket has been assigned to you by ${data.assignedBy}.

Ticket ID: ${data.ticketId}
Title: ${data.title}
Priority: ${data.priority}
${data.assetName ? `Asset: ${data.assetName}` : ''}
${data.description ? `Description: ${data.description}` : ''}

View: ${data.dashboardUrl || 'https://samsproject.in'}/tickets
  `.trim();
  
  return { subject, html, text };
}

export function ticketStatusUpdateTemplate(data: {
  ticketId: string;
  title: string;
  oldStatus: string;
  newStatus: string;
  updatedBy: string;
  comment?: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `Ticket Status Updated: ${data.title}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>Ticket Status Updated</h2>
      <p>Hello,</p>
      <p>The status of ticket <strong>${data.ticketId}</strong> has been updated by <strong>${data.updatedBy}</strong>.</p>
      
      <div class="info-box">
        <p><strong>Ticket:</strong> ${data.title}</p>
        <p><strong>Status Change:</strong> ${data.oldStatus} → ${data.newStatus}</p>
        ${data.comment ? `<p><strong>Comment:</strong> ${data.comment}</p>` : ''}
      </div>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/tickets" class="button">View Ticket</a>
    </div>
  `, `Ticket ${data.ticketId} status updated to ${data.newStatus}`);
  
  const text = `
Ticket Status Updated

Ticket ${data.ticketId} has been updated by ${data.updatedBy}.

Title: ${data.title}
Status: ${data.oldStatus} → ${data.newStatus}
${data.comment ? `Comment: ${data.comment}` : ''}

View: ${data.dashboardUrl || 'https://samsproject.in'}/tickets
  `.trim();
  
  return { subject, html, text };
}

// ====================
// AUDIT TEMPLATES
// ====================

export function auditStartedTemplate(data: {
  sessionId: string;
  frequency: string;
  propertyName?: string;
  initiatedBy: string;
  departments: string[];
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `New Audit Session Started`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>Audit Session Started</h2>
      <p>Hello,</p>
      <p>A new audit session has been initiated by <strong>${data.initiatedBy}</strong>.</p>
      
      <div class="info-box">
        <p><strong>Session ID:</strong> ${data.sessionId}</p>
        <p><strong>Frequency:</strong> ${data.frequency}</p>
        ${data.propertyName ? `<p><strong>Property:</strong> ${data.propertyName}</p>` : ''}
        <p><strong>Assigned Departments:</strong> ${data.departments.join(', ')}</p>
      </div>
      
      <p>Please ensure your department completes the audit review promptly.</p>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/audit" class="button">Go to Audit</a>
    </div>
  `, `New audit session ${data.sessionId} has been started`);
  
  const text = `
Audit Session Started

A new audit session has been initiated by ${data.initiatedBy}.

Session ID: ${data.sessionId}
Frequency: ${data.frequency}
${data.propertyName ? `Property: ${data.propertyName}` : ''}
Assigned Departments: ${data.departments.join(', ')}

Go to Audit: ${data.dashboardUrl || 'https://samsproject.in'}/audit
  `.trim();
  
  return { subject, html, text };
}

export function auditSubmittedTemplate(data: {
  sessionId: string;
  department: string;
  submittedBy: string;
  assetsReviewed: number;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `Audit Submitted: ${data.department}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>Audit Submitted</h2>
      <p>Hello,</p>
      <p>The audit for <strong>${data.department}</strong> has been submitted by <strong>${data.submittedBy}</strong>.</p>
      
      <div class="success-box">
        <p><strong>Session ID:</strong> ${data.sessionId}</p>
        <p><strong>Department:</strong> ${data.department}</p>
        <p><strong>Assets Reviewed:</strong> ${data.assetsReviewed}</p>
      </div>
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/audit" class="button">View Audit Report</a>
    </div>
  `, `Audit submitted for ${data.department}`);
  
  const text = `
Audit Submitted

The audit for ${data.department} has been submitted by ${data.submittedBy}.

Session ID: ${data.sessionId}
Department: ${data.department}
Assets Reviewed: ${data.assetsReviewed}

View Report: ${data.dashboardUrl || 'https://samsproject.in'}/audit
  `.trim();
  
  return { subject, html, text };
}

// ====================
// SYSTEM TEMPLATES
// ====================

export function welcomeEmailTemplate(data: {
  userName: string;
  userEmail: string;
  role: string;
  temporaryPassword?: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `Welcome to SAMS - Your Account is Ready`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>Welcome to SAMS</h2>
      <p>Hello <strong>${data.userName}</strong>,</p>
      <p>Your account has been created successfully. Welcome to the Smart Asset Management System!</p>
      
      <div class="info-box">
        <p><strong>Email:</strong> ${data.userEmail}</p>
        <p><strong>Role:</strong> ${data.role}</p>
        ${data.temporaryPassword ? `<p><strong>Temporary Password:</strong> ${data.temporaryPassword}</p>` : ''}
      </div>
      
      ${data.temporaryPassword ? `
      <div class="warning-box">
        <p><strong>Important:</strong> You will be required to change your password on first login.</p>
      </div>
      ` : ''}
      
      <a href="${data.dashboardUrl || 'https://samsproject.in'}/login" class="button">Login to Dashboard</a>
      
      <div class="divider"></div>
      
      <p><strong>Getting Started:</strong></p>
      <p>• Explore the asset management dashboard<br/>
      • Review your assigned assets and responsibilities<br/>
      • Configure your notification preferences in settings</p>
    </div>
  `, `Welcome to SAMS! Your account is ready.`);
  
  const text = `
Welcome to SAMS

Hello ${data.userName},

Your account has been created successfully.

Email: ${data.userEmail}
Role: ${data.role}
${data.temporaryPassword ? `Temporary Password: ${data.temporaryPassword}` : ''}

${data.temporaryPassword ? 'You will be required to change your password on first login.' : ''}

Login: ${data.dashboardUrl || 'https://samsproject.in'}/login
  `.trim();
  
  return { subject, html, text };
}

export function passwordResetTemplate(data: {
  userName: string;
  resetToken: string;
  expiresIn: string;
  dashboardUrl?: string;
}): EmailTemplate {
  const subject = `Password Reset Request - SAMS`;
  
  const resetUrl = `${data.dashboardUrl || 'https://samsproject.in'}/reset-password?token=${data.resetToken}`;
  
  const html = wrapTemplate(`
    <div class="email-body">
      <h2>Password Reset Request</h2>
      <p>Hello <strong>${data.userName}</strong>,</p>
      <p>We received a request to reset your password for your SAMS account.</p>
      
      <div class="warning-box">
        <p>This password reset link will expire in <strong>${data.expiresIn}</strong>.</p>
      </div>
      
      <a href="${resetUrl}" class="button">Reset Password</a>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #6c757d;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>
  `, `Password reset requested for your SAMS account`);
  
  const text = `
Password Reset Request

Hello ${data.userName},

We received a request to reset your password for your SAMS account.

Reset your password: ${resetUrl}

This link will expire in ${data.expiresIn}.

If you didn't request a password reset, you can safely ignore this email.
  `.trim();
  
  return { subject, html, text };
}

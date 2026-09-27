// The CRM mailer is isolated from NextAuth's optional legacy email-provider peer.
declare module "crm-nodemailer" {
  import nodemailer = require("nodemailer");
  export = nodemailer;
}

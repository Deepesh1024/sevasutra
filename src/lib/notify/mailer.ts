import type { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

export interface Mailer { name: string; send(m: { to: string; subject: string; text: string }): Promise<{ id: string }> }

/** Development: writes into the DevMail table, viewable at /dev/mailbox. */
export class DevMailer implements Mailer {
  name = "dev-mailbox";
  constructor(private db: PrismaClient) {}
  async send(m: { to: string; subject: string; text: string }) {
    const r = await this.db.devMail.create({ data: m });
    return { id: r.id };
  }
}

export class SmtpMailer implements Mailer {
  name = "smtp";
  private t = nodemailer.createTransport(process.env.SMTP_URL!);
  async send(m: { to: string; subject: string; text: string }) {
    const r = await this.t.sendMail({ from: process.env.MAIL_FROM, ...m });
    return { id: r.messageId };
  }
}

export function mailer(db: PrismaClient): Mailer {
  return process.env.SMTP_URL ? new SmtpMailer() : new DevMailer(db);
}

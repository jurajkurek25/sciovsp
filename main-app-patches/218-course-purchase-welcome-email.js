// Pridáva uvítací email zákazníkovi po kúpe kurzu (emails/course-purchased.html),
// rovnaký vzor ako generalka-purchase email (main-app-patches/151/153) --
// sendMail lokálne importovaný cez require('./mailer'), šablóna cez
// loadWebinarEmailTemplate() (napriek názvu je generická — číta z emails/
// podľa mena súboru), fillWebinarTemplate() na [PLACEHOLDER] substitúciu,
// getOrCreateUnsubscribeToken() na unsubscribe link. Všetky tri overené
// priamo z produkcie (main-app-patches/217).
//
// Kotva je CELÝ "course_purchase" blok webhooku (atomická náhrada,
// overená byte-presne cez main-app-patches/215 výstup, 3845 znakov).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/218-course-purchase-welcome-email.js

const fs = require("fs");
const path = require("path");

const SERVER_PATH = path.join(process.cwd(), "server.js");
if (!fs.existsSync(SERVER_PATH)) {
  console.error("❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.");
  process.exit(1);
}
const EMAIL_TEMPLATE_PATH = path.join(process.cwd(), "emails", "course-purchased.html");
if (!fs.existsSync(EMAIL_TEMPLATE_PATH)) {
  console.error("❌ Nenašiel som emails/course-purchased.html — over že si na najnovšom git pull.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".218-course-purchase-welcome-email-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(SERVER_PATH, "utf8");

const OLD = "if (session.metadata?.type === 'course_purchase') {\n          const courseCustomer = await stripe.customers.retrieve(session.customer);\n          const { data: purchasedCourse } = await supabase.from('courses').select('instructor_id, platform_cut_percent, referral_cut_percent').eq('id', session.metadata.courseId).maybeSingle();\n          const viaReferral = session.metadata.viaReferral === '1';\n          let instructorShareCents = null;\n          if (purchasedCourse?.instructor_id) {\n            const cutPercent = viaReferral ? purchasedCourse.referral_cut_percent : purchasedCourse.platform_cut_percent;\n            instructorShareCents = Math.round(session.amount_total * (100 - cutPercent) / 100);\n          }\n          await supabase.from('course_purchases').upsert({\n            course_id: session.metadata.courseId,\n            email: courseCustomer.email,\n            stripe_session_id: session.id,\n            amount_paid_cents: session.amount_total,\n            instructor_id: purchasedCourse?.instructor_id || null,\n            instructor_share_cents: instructorShareCents,\n            via_instructor_referral: viaReferral,\n            discount_code: session.metadata.discountCode || null\n          }, { onConflict: 'course_id,email' });\n          if (session.metadata.discountCode) {\n            (async () => {\n              try {\n                const { data: dcRow } = await supabase.from('course_discount_codes').select('id, used_count').ilike('code', session.metadata.discountCode).maybeSingle();\n                if (dcRow) await supabase.from('course_discount_codes').update({ used_count: dcRow.used_count + 1 }).eq('id', dcRow.id);\n              } catch (e) { console.error('discount code usage increment failed:', e.message); }\n            })();\n          }\n          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);\n          // Partnerská provízia (15 % z hrubej ceny, výhradne z podielu\n          // platformy — nemení instructor_share_cents vyššie).\n          if (session.metadata.partnerRefCode) {\n            const notifyPartnerCourseCredit = (payload) => {\n              if (!process.env.PARTNER_SERVER_URL || !process.env.PARTNER_WEBHOOK_KEY) return;\n              try {\n                const https = require('https');\n                const body = JSON.stringify(payload);\n                const url = new URL(process.env.PARTNER_SERVER_URL + '/api/partner/webhook/credit');\n                const httpReq = https.request(url, {\n                  method: 'POST',\n                  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-webhook-key': process.env.PARTNER_WEBHOOK_KEY }\n                });\n                httpReq.on('error', (e) => console.error('partner course credit webhook error:', e.message));\n                httpReq.write(body);\n                httpReq.end();\n              } catch (e) {\n                console.error('partner course credit webhook error:', e.message);\n              }\n            };\n            const COURSE_PARTNER_COMMISSION_PERCENT = 15;\n            const partnerCommissionCents = Math.round(session.amount_total * COURSE_PARTNER_COMMISSION_PERCENT / 100);\n            notifyPartnerCourseCredit({\n              refCode: session.metadata.partnerRefCode,\n              customerEmail: courseCustomer.email,\n              customerName: courseCustomer.name || null,\n              itemType: 'course',\n              courseSlug: session.metadata.courseSlug,\n              amountPaid: (session.amount_total || 0) / 100,\n              commissionAmount: partnerCommissionCents / 100,\n              isOneTime: true\n            });\n            console.log('💸 Partnerská provízia za kurz:', session.metadata.partnerRefCode, (partnerCommissionCents / 100).toFixed(2) + '€');\n          }\n          break;\n        }";
const NEW = "if (session.metadata?.type === 'course_purchase') {\n          const courseCustomer = await stripe.customers.retrieve(session.customer);\n          const { data: purchasedCourse } = await supabase.from('courses').select('title, instructor_id, platform_cut_percent, referral_cut_percent').eq('id', session.metadata.courseId).maybeSingle();\n          const viaReferral = session.metadata.viaReferral === '1';\n          let instructorShareCents = null;\n          if (purchasedCourse?.instructor_id) {\n            const cutPercent = viaReferral ? purchasedCourse.referral_cut_percent : purchasedCourse.platform_cut_percent;\n            instructorShareCents = Math.round(session.amount_total * (100 - cutPercent) / 100);\n          }\n          await supabase.from('course_purchases').upsert({\n            course_id: session.metadata.courseId,\n            email: courseCustomer.email,\n            stripe_session_id: session.id,\n            amount_paid_cents: session.amount_total,\n            instructor_id: purchasedCourse?.instructor_id || null,\n            instructor_share_cents: instructorShareCents,\n            via_instructor_referral: viaReferral,\n            discount_code: session.metadata.discountCode || null\n          }, { onConflict: 'course_id,email' });\n          if (session.metadata.discountCode) {\n            (async () => {\n              try {\n                const { data: dcRow } = await supabase.from('course_discount_codes').select('id, used_count').ilike('code', session.metadata.discountCode).maybeSingle();\n                if (dcRow) await supabase.from('course_discount_codes').update({ used_count: dcRow.used_count + 1 }).eq('id', dcRow.id);\n              } catch (e) { console.error('discount code usage increment failed:', e.message); }\n            })();\n          }\n          try {\n            const { sendMail } = require('./mailer');\n            const courseUrl = 'https://sptrener.online/kurzy/' + session.metadata.courseSlug;\n            const courseUnsubToken = await getOrCreateUnsubscribeToken(courseCustomer.email);\n            const coursePurchasedHtml = fillWebinarTemplate(loadWebinarEmailTemplate('course-purchased.html'), { COURSE_TITLE: purchasedCourse?.title || session.metadata.courseSlug, COURSE_URL: courseUrl, UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + courseUnsubToken });\n            sendMail({\n              to: courseCustomer.email,\n              subject: 'Vitaj v kurze ' + (purchasedCourse?.title || ''),\n              html: coursePurchasedHtml\n            }).catch(() => {});\n          } catch (e) {\n            console.error('course purchase email error:', e.message);\n          }\n          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);\n          // Partnerská provízia (15 % z hrubej ceny, výhradne z podielu\n          // platformy — nemení instructor_share_cents vyššie).\n          if (session.metadata.partnerRefCode) {\n            const notifyPartnerCourseCredit = (payload) => {\n              if (!process.env.PARTNER_SERVER_URL || !process.env.PARTNER_WEBHOOK_KEY) return;\n              try {\n                const https = require('https');\n                const body = JSON.stringify(payload);\n                const url = new URL(process.env.PARTNER_SERVER_URL + '/api/partner/webhook/credit');\n                const httpReq = https.request(url, {\n                  method: 'POST',\n                  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-webhook-key': process.env.PARTNER_WEBHOOK_KEY }\n                });\n                httpReq.on('error', (e) => console.error('partner course credit webhook error:', e.message));\n                httpReq.write(body);\n                httpReq.end();\n              } catch (e) {\n                console.error('partner course credit webhook error:', e.message);\n              }\n            };\n            const COURSE_PARTNER_COMMISSION_PERCENT = 15;\n            const partnerCommissionCents = Math.round(session.amount_total * COURSE_PARTNER_COMMISSION_PERCENT / 100);\n            notifyPartnerCourseCredit({\n              refCode: session.metadata.partnerRefCode,\n              customerEmail: courseCustomer.email,\n              customerName: courseCustomer.name || null,\n              itemType: 'course',\n              courseSlug: session.metadata.courseSlug,\n              amountPaid: (session.amount_total || 0) / 100,\n              commissionAmount: partnerCommissionCents / 100,\n              isOneTime: true\n            });\n            console.log('💸 Partnerská provízia za kurz:', session.metadata.partnerRefCode, (partnerCommissionCents / 100).toFixed(2) + '€');\n          }\n          break;\n        }";

if (src.includes("course purchase email error")) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  const count = src.split(OLD).length - 1;
  if (count !== 1) {
    console.error("❌ Kotva course_purchase bloku nie je jednoznačná (nájdených: " + count + "). Nič som nezmenil. Pošli mi aktuálny obsah, over.");
    process.exit(1);
  }
  src = src.replace(OLD, () => NEW);
  const backup = SERVER_PATH + ".pre-218-course-purchase-welcome-email-" + Date.now();
  fs.copyFileSync(SERVER_PATH, backup);
  fs.writeFileSync(SERVER_PATH, src);
  console.log("✅ server.js prepísaný (zákazník po kúpe kurzu dostane uvítací email). Záloha:", backup);
}

console.log("");
console.log("Over: node -c server.js");
console.log("Reštart: pm2 restart <meno procesu hlavnej appky> (over cez pm2 list).");

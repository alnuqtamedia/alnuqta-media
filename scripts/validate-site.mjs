import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "newsroom.html",
  "submit.html",
  "admin/dashboard.html",
  "admin/index.html",
  "admin/mfa.html",
  "public/newsletter.js",
  "public/supabase-feed.js",
  "public/newsroom-supabase.js",
  "robots.txt",
  "sitemap.xml",
  "privacy.html",
  "editorial-policy.html",
  "corrections.html",
  "contact.html",
  "public/policy.css",
  ".github/workflows/pages-deploy.yml",
];

for (const file of requiredFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error(`Missing required file: ${file}`);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const newsroom = fs.readFileSync(path.join(root, "newsroom.html"), "utf8");
const submit = fs.readFileSync(path.join(root, "submit.html"), "utf8");
const adminLogin = fs.readFileSync(path.join(root, "admin/index.html"), "utf8");
const adminMfa = fs.readFileSync(path.join(root, "admin/mfa.html"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "admin/dashboard.html"), "utf8");
const homepageInjector = fs.readFileSync(path.join(root, "scripts/inject-homepage-feed.mjs"), "utf8");
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const privacy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
const editorialPolicy = fs.readFileSync(path.join(root, "editorial-policy.html"), "utf8");
const corrections = fs.readFileSync(path.join(root, "corrections.html"), "utf8");
const contact = fs.readFileSync(path.join(root, "contact.html"), "utf8");
if (!newsroom.includes("public/newsroom-supabase.js")) throw new Error("Newsroom must load the Supabase feed");
if (!index.includes("public/supabase-feed.js") && !homepageInjector.includes("public/supabase-feed.js")) {
  throw new Error("Homepage deployment must inject the Supabase feed");
}

if (!index.includes('rel="canonical"') || !newsroom.includes('rel="canonical"')) throw new Error("Public pages need canonical URLs");
if (!robots.includes("sitemap.xml")) throw new Error("robots.txt must reference sitemap.xml");
if (!sitemap.includes("newsroom.html") || !sitemap.includes("alnuqtamedia.github.io/alnuqta-media/")) throw new Error("sitemap.xml is missing core public URLs");
for (const page of ["privacy.html", "editorial-policy.html", "corrections.html", "contact.html"]) {
  if (!sitemap.includes(page)) throw new Error(`sitemap.xml is missing policy page: ${page}`);
  if (!index.includes(`href="${page}"`)) throw new Error(`Homepage footer is missing policy page: ${page}`);
}
if (!privacy.includes("180 يوماً") || !privacy.includes("ليست SecureDrop") || !privacy.includes("لا نبيع البيانات")) {
  throw new Error("Privacy policy must disclose source retention, anonymity limits and data-sale policy.");
}
if (!editorialPolicy.includes("حق الرد") || !editorialPolicy.includes("الذكاء الاصطناعي")) {
  throw new Error("Editorial policy must cover right of reply and AI-generated media.");
}
if (!corrections.includes("طلب تصحيح") || !contact.includes("alnuqtamedia@gmail.com")) {
  throw new Error("Corrections and public contact routes are incomplete.");
}
if (/href=["'][^"']*admin\/?["']/.test(index)) throw new Error("Public homepage must not expose the private admin login link");
if (!adminLogin.includes("../public/supabase-public-config.js") || !dashboard.includes("../public/supabase-public-config.js")) throw new Error("Admin pages must load Supabase runtime config");
if (!adminLogin.includes("getAuthenticatorAssuranceLevel") || !adminMfa.includes("challengeAndVerify") || !adminMfa.includes("mfa.enroll")) throw new Error("Admin MFA flow is incomplete");
if (!dashboard.includes("callManageTeam({action:'directory'})") || !dashboard.includes("callManageTeam({action:'list'})")) {
  throw new Error("Dashboard secure newsroom team integrations are missing");
}
if (dashboard.includes("owner_list_team") || dashboard.includes("newsroom_team_directory")) {
  throw new Error("Dashboard must not call privileged team-directory RPCs directly");
}
if (!dashboard.includes("source_submissions") || !dashboard.includes("source-submissions")) throw new Error("Dashboard source inbox integration is missing");
if (!submit.includes("/functions/v1/source-submit") || !submit.includes('name="consent"')) throw new Error("Secure source submission integration is missing");
if (!index.includes("newsletter-form") || !newsroom.includes("newsletter-form")) throw new Error("Newsletter signup must exist on homepage and newsroom");
if (!dashboard.includes("newsletter_subscribers")) throw new Error("Dashboard newsletter subscriber integration is missing");
for (const category of ["politics", "economy-public-money", "field-social", "culture-arts", "travel-tourism", "sports"]) {
  if (!index.includes(`newsroom.html?section=${category}`)) throw new Error(`Homepage newsroom menu is missing category: ${category}`);
}

const misleadingSecurityClaims = [
  "تشفير الاتصال وآلية حماية المصادر مفعلة",
  "تم استلام معلوماتك وتشفيرها بنجاح",
  "صندوق التسريبات الآمن",
  "إرسال تسريب آمن",
];

const retiredHomepageContent = [
  'data-netlify="true"',
  'handleTipSubmit',
  'openInvestigationModal',
  'مفحوص وموثق',
  'شركات الوهم',
  'جفاف الأهوار',
];

for (const phrase of retiredHomepageContent) {
  if (index.includes(phrase)) {
    throw new Error(`Retired or unverified homepage content returned: ${phrase}`);
  }
}

if (!index.includes('id="homepage-feed"') || !index.includes('public/supabase-feed.js')) {
  throw new Error('Homepage must render its published content from Supabase.');
}

for (const phrase of misleadingSecurityClaims) {
  if (index.includes(phrase) || submit.includes(phrase)) {
    throw new Error(`Unsafe/unverified security claim remains in a public page: ${phrase}`);
  }
}

console.log("Site validation passed: Supabase is the newsroom source and required integrations are present.");

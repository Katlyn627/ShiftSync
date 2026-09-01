import { getDb } from './db';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { seedSurveyTemplates, VALIDATED_SURVEY_INSTRUMENTS } from './surveys';

function currentWeekMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  return monday.toISOString().split('T')[0];
}

function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const MAX_EMPLOYEES = 90;
const MIN_EXPECTED_EMPLOYEES = 68;
const EXPECTED_SITES = [
  { name: 'Bella Napoli', siteType: 'restaurant' },
  { name: 'The Blue Door', siteType: 'restaurant' },
  { name: 'Global Impact Initiative', siteType: 'nonprofit' },
];

function shouldReseed(db: Database.Database): boolean {
  const siteRows = db.prepare('SELECT name, site_type FROM sites').all() as { name: string; site_type: string }[];
  if (siteRows.length < EXPECTED_SITES.length) return true;
  if (EXPECTED_SITES.some((site) => !siteRows.some((row) => row.name === site.name && row.site_type === site.siteType))) return true;

  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  if (empCount < MIN_EXPECTED_EMPLOYEES || empCount > MAX_EMPLOYEES) return true;

  const empsWithSite = (db.prepare('SELECT COUNT(*) as c FROM employees WHERE site_id IS NOT NULL').get() as any).c;
  if (empsWithSite !== empCount) return true;

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  if (userCount < empCount) return true;

  const forecastsWithSite = (db.prepare('SELECT COUNT(*) as c FROM forecasts WHERE site_id IS NOT NULL').get() as any).c;
  if (forecastsWithSite < 14) return true;

  const schedulesWithSite = (db.prepare('SELECT COUNT(*) as c FROM schedules WHERE site_id IS NOT NULL').get() as any).c;
  if (schedulesWithSite < EXPECTED_SITES.length) return true;

  const surveyTemplatesCount = (db.prepare('SELECT COUNT(*) as c FROM survey_templates').get() as any).c;
  if (surveyTemplatesCount === 0) return true;

  const devonUser = db.prepare("SELECT id FROM users WHERE username = 'miller_d'").get();
  if (!devonUser) return true;

  const unsplashEmp = db.prepare("SELECT id FROM employees WHERE photo_url LIKE '%images.unsplash.com%'").get();
  if (!unsplashEmp) return true;

  const giiSched = db.prepare("SELECT labor_budget FROM schedules s JOIN sites st ON s.site_id = st.id WHERE st.name = 'Global Impact Initiative' LIMIT 1").get() as any;
  if (!giiSched || giiSched.labor_budget < 20000) return true;

  const openShiftCount = (db.prepare('SELECT COUNT(*) as c FROM open_shifts').get() as any).c;
  if (openShiftCount < 5) return true;

  const timeOffCount = (db.prepare('SELECT COUNT(*) as c FROM time_off_requests').get() as any).c;
  if (timeOffCount < 5) return true;

  const swapCount = (db.prepare('SELECT COUNT(*) as c FROM shift_swaps').get() as any).c;
  if (swapCount < 4) return true;

  const availCount = (db.prepare('SELECT COUNT(*) as c FROM availability').get() as any).c;
  if (availCount < empCount * 7) return true;

  return false;
}

function clearSeedData(db: Database.Database): void {
  db.exec(`
    DELETE FROM survey_answers;
    DELETE FROM survey_responses;
    DELETE FROM survey_campaigns;
    DELETE FROM survey_templates;
    DELETE FROM change_requests;
    DELETE FROM callouts;
    DELETE FROM publish_sla;
    DELETE FROM open_shift_offers;
    DELETE FROM open_shifts;
    DELETE FROM shift_swaps;
    DELETE FROM shifts;
    DELETE FROM schedules;
    DELETE FROM availability;
    DELETE FROM forecasts;
    DELETE FROM users;
    DELETE FROM employees;
    DELETE FROM site_positions;
    DELETE FROM sites;
  `);
}

interface SiteSeed {
  name: string;
  city: string;
  state: string;
  timezone: string;
  siteType: string;
  jurisdiction: string;
  emailDomain: string;
  address: string;
  businessHours: string;
  employeeCapacity: number;
  baseRevenue: number;
  averageCheckSize: number;
  fohRoles: string[];
  bohRoles: string[];
  rolePlan: RoleSeed[];
}

interface RoleSeed {
  role: string;
  roleTitle?: string;
  department: string;
  count: number;
  minRate: number;
  maxRate: number;
  weeklyMax: number;
  isManager?: boolean;
  isVolunteer?: boolean;
  certifications?: string[];
  skills?: string[];
  backgroundCheckStatus?: string;
  forcedUsernames?: string[];
  preferredNames?: Array<{ first: string; last: string }>;
}

const RESTAURANT_FOH_ROLES = ['Busser', 'Host', 'Server', 'Food Runner', 'Expo'];
const RESTAURANT_BOH_ROLES = ['Line Cook', 'Head Chef', 'Sous Chef', 'Dishwasher', 'Manager'];

const RESTAURANT_ROLE_PLAN: RoleSeed[] = [
  { role: 'Manager', department: 'Management', count: 2, minRate: 22, maxRate: 26, weeklyMax: 45, isManager: true, certifications: ['ServSafe_Manager', 'First_Aid'] },
  { role: 'Head Chef', department: 'Back of House', count: 1, minRate: 23, maxRate: 27, weeklyMax: 45, certifications: ['ServSafe_Manager', 'Culinary_Arts'] },
  { role: 'Sous Chef', department: 'Back of House', count: 1, minRate: 20, maxRate: 24, weeklyMax: 42, certifications: ['ServSafe_FoodHandler'] },
  { role: 'Line Cook', department: 'Back of House', count: 4, minRate: 16, maxRate: 20, weeklyMax: 40, certifications: ['ServSafe_FoodHandler'] },
  { role: 'Dishwasher', department: 'Back of House', count: 2, minRate: 13, maxRate: 15, weeklyMax: 36 },
  { role: 'Server', department: 'Front of House', count: 7, minRate: 13, maxRate: 16, weeklyMax: 38, certifications: ['TIPS_Alcohol'] },
  { role: 'Host', department: 'Front of House', count: 2, minRate: 13, maxRate: 15, weeklyMax: 34 },
  { role: 'Busser', department: 'Front of House', count: 2, minRate: 12, maxRate: 14, weeklyMax: 34 },
  { role: 'Food Runner', department: 'Front of House', count: 2, minRate: 13, maxRate: 15, weeklyMax: 36 },
  { role: 'Expo', department: 'Front of House', count: 1, minRate: 15, maxRate: 18, weeklyMax: 38 },
];

const HUMANITARIAN_FOH_ROLES = [
  'Program Officer',
  'Field Coordinator',
  'Volunteer Coordinator',
  'Child Development Specialist',
  'Community Health Case Worker',
  'Volunteer',
];
const HUMANITARIAN_BOH_ROLES = [
  'International Program Manager',
  'Chief Executive Officer',
  'Finance and HR Coordinator',
  'Monitoring and Evaluation Officer',
  'Safeguarding Officer',
  'Logistics and Grants Coordinator',
];

const HUMANITARIAN_ROLE_PLAN: RoleSeed[] = [
  {
    role: 'Manager',
    roleTitle: 'Chief Executive Officer',
    department: 'Executive Leadership',
    count: 1,
    minRate: 38,
    maxRate: 43,
    weeklyMax: 45,
    isManager: true,
    forcedUsernames: ['gii_ceo'],
    preferredNames: [{ first: 'Marcus', last: 'Vance' }],
    certifications: ['FEMA_ICS_400', 'NGO_Governance_Leadership', 'FBI_DOJ_Cleared'],
    skills: ['Strategic Planning', 'Crisis Management', 'Donor Relations'],
    backgroundCheckStatus: 'cleared_fbi_doj',
  },
  {
    role: 'Manager',
    roleTitle: 'International Program Manager',
    department: 'Humanitarian Aid & Emergency Relief',
    count: 1,
    minRate: 34,
    maxRate: 38,
    weeklyMax: 45,
    isManager: true,
    forcedUsernames: ['gii_ipm'],
    preferredNames: [{ first: 'Tariq', last: 'Al-Mansoor' }],
    certifications: ['FEMA_ICS_400', 'HazMat_Handler', 'START_Triage', 'FBI_DOJ_Cleared'],
    skills: ['Rapid Relief Logistics', 'Disaster Triage', 'Arabic Fluency'],
    backgroundCheckStatus: 'cleared_fbi_doj',
  },
  {
    role: 'Manager',
    roleTitle: 'Program Officer - Girls Education and Empowerment',
    department: 'Child Development & Youth Services',
    count: 1,
    minRate: 30,
    maxRate: 34,
    weeklyMax: 44,
    isManager: true,
    forcedUsernames: ['gii_programofficer'],
    preferredNames: [{ first: 'Nia', last: 'Kimani' }],
    certifications: ['CPR_AED_Pediatric', 'Early_Childhood_Licensure', 'Trauma_Informed_Care', 'FBI_DOJ_Cleared'],
    skills: ['Child Trauma Assessment', 'Youth Mentorship', 'Curriculum Design'],
    backgroundCheckStatus: 'cleared_fbi_doj',
  },
  {
    role: 'Program Officer',
    department: 'Child Development & Youth Services',
    count: 5,
    minRate: 24,
    maxRate: 29,
    weeklyMax: 42,
    certifications: ['CPR_AED_Pediatric', 'Trauma_Informed_Care', 'FBI_DOJ_Cleared'],
    skills: ['Youth Development', 'Case Management'],
    backgroundCheckStatus: 'cleared_fbi_doj',
  },
  {
    role: 'Field Coordinator',
    department: 'Humanitarian Aid & Emergency Relief',
    count: 4,
    minRate: 22,
    maxRate: 26,
    weeklyMax: 42,
    forcedUsernames: ['gii_fieldlead'],
    preferredNames: [{ first: 'Kofi', last: 'Achebe' }],
    certifications: ['FEMA_ICS_400', 'START_Triage', 'Field_Security_Level2', 'FBI_DOJ_Cleared'],
    skills: ['Emergency Dispatch', 'Field Logistics', 'First Aid'],
    backgroundCheckStatus: 'cleared_fbi_doj',
  },
  {
    role: 'Volunteer Coordinator',
    department: 'Volunteer & Community Engagement',
    count: 4,
    minRate: 20,
    maxRate: 24,
    weeklyMax: 40,
    certifications: ['Volunteer_Supervision_Cert', 'Mental_Health_First_Aid'],
    skills: ['Volunteer Engagement', 'Onboarding', 'Spanish Fluency'],
    backgroundCheckStatus: 'cleared_level2',
  },
  {
    role: 'Child Development Specialist',
    department: 'Child Development & Youth Services',
    count: 5,
    minRate: 23,
    maxRate: 28,
    weeklyMax: 42,
    certifications: ['CPR_AED_Pediatric', 'Early_Childhood_Licensure', 'Trauma_Informed_Care', 'FBI_DOJ_Cleared'],
    skills: ['Early Childhood Care', 'Trauma-Informed De-escalation'],
    backgroundCheckStatus: 'cleared_fbi_doj',
  },
  {
    role: 'Monitoring and Evaluation Officer',
    department: 'Development & Grant Management',
    count: 3,
    minRate: 25,
    maxRate: 31,
    weeklyMax: 42,
    certifications: ['Grant_Compliance_Audit', 'Data_Governance_Cert'],
    skills: ['Statistical Analysis', 'M&E Frameworks', 'Grant Reporting'],
    backgroundCheckStatus: 'cleared_level2',
  },
  {
    role: 'Safeguarding Officer',
    department: 'Community Health & Psycho-Social Support',
    count: 3,
    minRate: 24,
    maxRate: 29,
    weeklyMax: 40,
    certifications: ['MSW_LCSW', 'Child_Protection_Advanced', 'FBI_DOJ_Cleared'],
    skills: ['Safeguarding Audits', 'Trauma Counseling'],
    backgroundCheckStatus: 'cleared_fbi_doj',
  },
  {
    role: 'Logistics and Grants Coordinator',
    department: 'Development & Grant Management',
    count: 3,
    minRate: 21,
    maxRate: 25,
    weeklyMax: 40,
    certifications: ['HazMat_Handler', 'Grant_Management_Pro'],
    skills: ['Supply Chain', 'Procurement', 'Inventory Tracking'],
    backgroundCheckStatus: 'cleared_level2',
  },
  {
    role: 'Finance and HR Coordinator',
    department: 'Finance, HR & Administrative Ops',
    count: 2,
    minRate: 24,
    maxRate: 29,
    weeklyMax: 40,
    certifications: ['SHRM_CP', 'Nonprofit_Accounting_Cert'],
    skills: ['Payroll Ops', 'Compliance Reporting'],
    backgroundCheckStatus: 'cleared_level2',
  },
  {
    role: 'Community Health Case Worker',
    department: 'Community Health & Psycho-Social Support',
    count: 3,
    minRate: 23,
    maxRate: 27,
    weeklyMax: 40,
    certifications: ['MSW_LCSW', 'Mental_Health_First_Aid', 'CPR_AED_Pediatric'],
    skills: ['Crisis De-escalation', 'Family Case Work', 'Mental Health Support'],
    backgroundCheckStatus: 'cleared_fbi_doj',
  },
  {
    role: 'Volunteer',
    roleTitle: 'Volunteer - Community Relief & Youth Support',
    department: 'Volunteer & Community Engagement',
    count: 5,
    minRate: 0,
    maxRate: 0,
    weeklyMax: 16,
    isVolunteer: true,
    preferredNames: [
      { first: 'Devon', last: 'Miller' },
      { first: 'Soraya', last: 'Haddad' },
      { first: 'Lucas', last: 'Becker' },
      { first: 'Fatima', last: 'Zahra' },
      { first: 'Patrick', last: 'Gallagher' },
    ],
    certifications: ['Basic_First_Aid', 'Youth_Safety_Awareness'],
    skills: ['Community Outreach', 'Food Pantry Sorting', 'Child Supervision Assistance'],
    backgroundCheckStatus: 'cleared_standard',
  },
];

const SITE_SEED: SiteSeed[] = [
  {
    name: 'Global Impact Initiative',
    city: 'Washington',
    state: 'DC',
    timezone: 'America/New_York',
    siteType: 'nonprofit',
    jurisdiction: 'intl-program',
    emailDomain: 'globalimpactinitiative.org',
    address: '1800 I St NW, Washington, DC',
    businessHours: 'Mon-Fri 08:00-19:00',
    employeeCapacity: 34,
    baseRevenue: 4100,
    averageCheckSize: 52,
    fohRoles: HUMANITARIAN_FOH_ROLES,
    bohRoles: HUMANITARIAN_BOH_ROLES,
    rolePlan: HUMANITARIAN_ROLE_PLAN,
  },
  {
    name: 'Bella Napoli',
    city: 'Chicago',
    state: 'IL',
    timezone: 'America/Chicago',
    siteType: 'restaurant',
    jurisdiction: 'us-il',
    emailDomain: 'bellanapoli.com',
    address: '120 W Randolph St, Chicago, IL',
    businessHours: 'Mon-Sun 11:00-23:00',
    employeeCapacity: 24,
    baseRevenue: 6200,
    averageCheckSize: 31,
    fohRoles: RESTAURANT_FOH_ROLES,
    bohRoles: RESTAURANT_BOH_ROLES,
    rolePlan: RESTAURANT_ROLE_PLAN,
  },
  {
    name: 'The Blue Door',
    city: 'Austin',
    state: 'TX',
    timezone: 'America/Chicago',
    siteType: 'restaurant',
    jurisdiction: 'us-tx',
    emailDomain: 'bluedoor.com',
    address: '410 Congress Ave, Austin, TX',
    businessHours: 'Mon-Sun 10:00-22:00',
    employeeCapacity: 24,
    baseRevenue: 5600,
    averageCheckSize: 30,
    fohRoles: RESTAURANT_FOH_ROLES,
    bohRoles: RESTAURANT_BOH_ROLES,
    rolePlan: RESTAURANT_ROLE_PLAN,
  },
];

function shiftWindowForRole(role: string, indexInRole: number): { start: string; end: string } {
  if (role === 'Manager') return { start: '09:00', end: '17:00' };
  if (role === 'Program Officer') return indexInRole % 2 === 0 ? { start: '08:30', end: '16:30' } : { start: '10:00', end: '18:00' };
  if (role === 'Field Coordinator') return indexInRole % 2 === 0 ? { start: '07:30', end: '15:30' } : { start: '09:00', end: '17:00' };
  if (role === 'Volunteer Coordinator') return { start: '09:00', end: '17:00' };
  if (role === 'Child Development Specialist') return indexInRole % 2 === 0 ? { start: '08:00', end: '16:00' } : { start: '11:00', end: '19:00' };
  if (role === 'Monitoring and Evaluation Officer') return { start: '09:00', end: '17:00' };
  if (role === 'Safeguarding Officer') return { start: '10:00', end: '18:00' };
  if (role === 'Logistics and Grants Coordinator') return { start: '09:30', end: '17:30' };
  if (role === 'Finance and HR Coordinator') return { start: '09:00', end: '17:00' };
  if (role === 'Community Health Case Worker') return indexInRole % 2 === 0 ? { start: '08:30', end: '16:30' } : { start: '11:00', end: '19:00' };
  if (role === 'Volunteer') return indexInRole % 2 === 0 ? { start: '09:00', end: '13:00' } : { start: '13:00', end: '17:00' };
  if (role === 'Head Chef') return { start: '08:00', end: '16:00' };
  if (role === 'Sous Chef') return { start: '10:00', end: '18:00' };
  if (role === 'Line Cook') return indexInRole % 2 === 0 ? { start: '10:00', end: '18:00' } : { start: '14:00', end: '22:00' };
  if (role === 'Dishwasher') return { start: '15:00', end: '23:00' };
  if (role === 'Server') return indexInRole % 2 === 0 ? { start: '11:00', end: '19:00' } : { start: '15:00', end: '23:00' };
  if (role === 'Host') return { start: '10:00', end: '18:00' };
  if (role === 'Busser') return { start: '11:00', end: '19:00' };
  if (role === 'Food Runner') return { start: '12:00', end: '20:00' };
  return { start: '13:00', end: '21:00' }; // Expo fallback
}

const NAMED_PORTRAITS: Record<string, string> = {
  'marcus-vance': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=faces&q=80',
  'tariq-al-mansoor': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces&q=80',
  'nia-kimani': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&h=256&fit=crop&crop=faces&q=80',
  'kofi-achebe': 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=256&h=256&fit=crop&crop=faces&q=80',
  'devon-miller': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=256&h=256&fit=crop&crop=faces&q=80',
  'soraya-haddad': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&h=256&fit=crop&crop=faces&q=80',
  'lucas-becker': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=256&h=256&fit=crop&crop=faces&q=80',
  'fatima-zahra': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=faces&q=80',
  'patrick-gallagher': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=256&h=256&fit=crop&crop=faces&q=80',
  'alice-johnson': 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=256&h=256&fit=crop&crop=faces&q=80',
  'bob-smith': 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=256&h=256&fit=crop&crop=faces&q=80',
};

const DIVERSE_PORTRAITS: string[] = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1534751516642-a171ed2c2188?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1548142813-c348350df52b?w=256&h=256&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=256&h=256&fit=crop&crop=faces&q=80',
];

function seededPhotoUrl(firstName: string, lastName: string, role: string): string {
  const key = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (NAMED_PORTRAITS[key]) {
    return NAMED_PORTRAITS[key];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % DIVERSE_PORTRAITS.length;
  return DIVERSE_PORTRAITS[idx];
}

export function seedDemoData(): void {
  const db = getDb();

  const needsReseed = shouldReseed(db);
  if (!needsReseed) {
    const existingCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
    if (existingCount > 0) return;
  }

  db.transaction(() => {
    if (needsReseed) clearSeedData(db);

    const insertSite = db.prepare(
      `INSERT INTO sites (
        name, city, state, timezone, site_type, jurisdiction,
        address, business_hours, employee_capacity, foh_roles, boh_roles
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const seededSites: Array<SiteSeed & { id: number }> = [];
    for (const s of SITE_SEED) {
      const result = insertSite.run(
        s.name,
        s.city,
        s.state,
        s.timezone,
        s.siteType,
        s.jurisdiction,
        s.address,
        s.businessHours,
        s.employeeCapacity,
        JSON.stringify(s.fohRoles),
        JSON.stringify(s.bohRoles),
      );
      seededSites.push({ ...s, id: result.lastInsertRowid as number });
    }

    const firstNames = [
      'Alice', 'Blake', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack',
      'Karen', 'Liam', 'Mia', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Ruby', 'Sam', 'Tina',
      'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zane', 'Ava', 'Ben', 'Chloe', 'Derek',
      'Elena', 'Felix', 'Gina', 'Hugo', 'Isla', 'Jalen', 'Kira', 'Leo', 'Mason', 'Nina',
      'Owen', 'Paige', 'Rafael', 'Sofia', 'Theo', 'Val', 'Wyatt', 'Zoe',
    ];
    const lastNames = [
      'Johnson', 'Smith', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson',
      'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark',
    ];

    const insertEmployee = db.prepare(`
      INSERT INTO employees (
        name, first_name, last_name, role, role_title, department,
        pay_type, hourly_rate, weekly_hours_max, email, phone, photo_url, hire_date, site_id,
        certifications, skills, is_volunteer, volunteer_max_hours, emergency_contact, background_check_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAvailability = db.prepare(
      'INSERT INTO availability (employee_id, day_of_week, start_time, end_time, availability_type) VALUES (?, ?, ?, ?, ?)' 
    );

    const insertPosition = db.prepare(
      'INSERT OR IGNORE INTO site_positions (site_id, name, sort_order) VALUES (?, ?, ?)' 
    );

    let personCursor = 0;
    const allEmployees: Array<{ id: number; role: string; site_id: number; roleIndex: number; roleTitle: string; isManager: boolean; isVolunteer: boolean; forcedUsername?: string }> = [];

    for (const site of seededSites) {
      const allRolesForSite = [...new Set([...site.fohRoles, ...site.bohRoles])];
      allRolesForSite.forEach((role, idx) => insertPosition.run(site.id, role, idx));

      for (const roleSeed of site.rolePlan) {
        for (let i = 0; i < roleSeed.count; i++) {
          const first = firstNames[personCursor % firstNames.length];
          const last = lastNames[(personCursor + i) % lastNames.length];
          personCursor++;

          let adjustedFirst = first;
          let adjustedLast = last;
          if (site.name === 'Bella Napoli' && roleSeed.role === 'Manager' && i === 0) adjustedFirst = 'Alice';
          if (site.name === 'Bella Napoli' && roleSeed.role === 'Server' && i === 0) adjustedFirst = 'Bob';
          if (roleSeed.preferredNames?.[i]) {
            adjustedFirst = roleSeed.preferredNames[i].first;
            adjustedLast = roleSeed.preferredNames[i].last;
          }
          const name = `${adjustedFirst} ${adjustedLast}`;
          const hourlyRate = Number((roleSeed.minRate + ((i % 3) / 2) * (roleSeed.maxRate - roleSeed.minRate)).toFixed(2));
          const payType = roleSeed.isManager || roleSeed.role === 'Manager' ? 'salaried' : (roleSeed.isVolunteer ? 'volunteer' : 'hourly');
          const email = `${adjustedFirst.toLowerCase()}.${adjustedLast.toLowerCase()}@${site.emailDomain}`;
          const phone = `(555) ${String(1000 + personCursor).padStart(4, '0')}`;
          const roleTitle = roleSeed.roleTitle || roleSeed.role;
          const photoUrl = seededPhotoUrl(adjustedFirst, adjustedLast, roleTitle);
          const certsJson = JSON.stringify(roleSeed.certifications || []);
          const skillsJson = JSON.stringify(roleSeed.skills || []);
          const isVol = roleSeed.isVolunteer ? 1 : 0;
          const volMax = roleSeed.isVolunteer ? roleSeed.weeklyMax : 16;
          const bgCheck = roleSeed.backgroundCheckStatus || (site.siteType === 'nonprofit' ? 'cleared_level2' : 'cleared_standard');
          const emergencyContact = `(555) 999-${String(1000 + personCursor).padStart(4, '0')} (Primary Contact)`;

          const empResult = insertEmployee.run(
            name,
            adjustedFirst,
            adjustedLast,
            roleSeed.role,
            roleTitle,
            roleSeed.department,
            payType,
            hourlyRate,
            roleSeed.weeklyMax,
            email,
            phone,
            photoUrl,
            addDays('2022-01-01', personCursor),
            site.id,
            certsJson,
            skillsJson,
            isVol,
            volMax,
            emergencyContact,
            bgCheck
          );

          const employeeId = empResult.lastInsertRowid as number;
          allEmployees.push({
            id: employeeId,
            role: roleSeed.role,
            site_id: site.id,
            roleIndex: i,
            roleTitle,
            isManager: !!roleSeed.isManager || roleSeed.role === 'Manager',
            isVolunteer: !!roleSeed.isVolunteer,
            forcedUsername: roleSeed.forcedUsernames?.[i],
          });

          for (let day = 0; day < 7; day++) {
            insertAvailability.run(employeeId, day, '08:00', '23:59', 'specific');
          }
        }
      }
    }

    const thisMonday = currentWeekMonday();
    const lastMonday = addDays(thisMonday, -7);

    const insertForecast = db.prepare(
      'INSERT INTO forecasts (date, site_id, expected_revenue, expected_covers) VALUES (?, ?, ?, ?)' 
    );
    const DAY_REVENUE_MULTIPLIERS = [0.86, 0.82, 0.9, 0.98, 1.12, 1.2, 1.04]; // Monday..Sunday

    for (const weekStart of [lastMonday, thisMonday]) {
      for (const site of seededSites) {
        for (let d = 0; d < 7; d++) {
          const date = addDays(weekStart, d);
          const baseRevenue = site.baseRevenue;
          const weeklyTrend = weekStart === thisMonday ? 1.03 : 0.97;
          const dayVariance = (((site.id * 37 + d * 19 + (weekStart === thisMonday ? 11 : 3)) % 7) - 3) * 85;
          const expectedRevenue = Math.max(1800, Math.round(baseRevenue * DAY_REVENUE_MULTIPLIERS[d] * weeklyTrend + dayVariance));
          const expectedCovers = Math.max(40, Math.round(expectedRevenue / site.averageCheckSize));
          insertForecast.run(date, site.id, expectedRevenue, expectedCovers);
        }
      }
    }

    const insertSchedule = db.prepare(
      "INSERT INTO schedules (week_start, labor_budget, status, site_id) VALUES (?, ?, 'published', ?)"
    );
    const insertShift = db.prepare(
      "INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, role, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
    );

    const roleWorkloadFactor: Record<string, number> = {
      Manager: 0.95,
      'Head Chef': 0.9,
      'Sous Chef': 0.88,
      'Line Cook': 0.76,
      Dishwasher: 0.72,
      Server: 0.68,
      Host: 0.62,
      Busser: 0.62,
      'Food Runner': 0.66,
      Expo: 0.65,
      'Program Officer': 0.72,
      'Field Coordinator': 0.7,
      'Volunteer Coordinator': 0.62,
      'Child Development Specialist': 0.7,
      'Monitoring and Evaluation Officer': 0.64,
      'Safeguarding Officer': 0.66,
      'Logistics and Grants Coordinator': 0.63,
      Volunteer: 0.55,
    };
    const dayWorkProbability = [0.62, 0.58, 0.64, 0.74, 0.84, 0.88, 0.72]; // Monday..Sunday

    const currentScheduleBySite = new Map<number, number>();
    for (const weekStart of [lastMonday, thisMonday]) {
      for (const site of seededSites) {
        const scheduleLaborBudget = site.siteType === 'nonprofit' ? 24500 : 12500;
        const scheduleId = insertSchedule.run(weekStart, scheduleLaborBudget, site.id).lastInsertRowid as number;
        if (weekStart === thisMonday) {
          currentScheduleBySite.set(site.id, scheduleId);
        }
        const siteEmployees = allEmployees.filter(e => e.site_id === site.id);

        for (let d = 0; d < 7; d++) {
          const date = addDays(weekStart, d);
          let managersScheduled = 0;
          for (const emp of siteEmployees) {
            const workFactor = roleWorkloadFactor[emp.role] ?? 0.66;
            const threshold = Math.min(96, Math.round(dayWorkProbability[d] * workFactor * 100));
            const deterministic = (emp.id * 31 + site.id * 17 + d * 13 + (weekStart === thisMonday ? 7 : 3) + emp.roleIndex * 5) % 100;
            if (deterministic >= threshold) continue;
            const times = shiftWindowForRole(emp.role, emp.roleIndex);
            insertShift.run(scheduleId, emp.id, date, times.start, times.end, emp.role);
            if (emp.role === 'Manager') managersScheduled += 1;
          }

          if (managersScheduled === 0) {
            const fallbackManager = siteEmployees.find((employee) => employee.role === 'Manager');
            if (fallbackManager) {
              const fallbackTimes = shiftWindowForRole(fallbackManager.role, fallbackManager.roleIndex);
              insertShift.run(scheduleId, fallbackManager.id, date, fallbackTimes.start, fallbackTimes.end, fallbackManager.role);
            }
          }
        }
      }
    }

    const insertUser = db.prepare(
      'INSERT OR IGNORE INTO users (username, password_hash, employee_id, is_manager) VALUES (?, ?, ?, ?)'
    );
    const allSeeded = db.prepare('SELECT id, role, first_name, last_name, name FROM employees ORDER BY id').all() as any[];
    const usedUsernames = new Set<string>();

    for (const emp of allSeeded) {
      const first = String(emp.first_name || 'user').toLowerCase().trim();
      const last = String(emp.last_name || '').toLowerCase().trim();
      const isManager = emp.role === 'Manager' ? 1 : 0;
      const hash = bcrypt.hashSync('password123', 4);

      // 1. Primary format: lastname_firstinitial (e.g. miller_d, achebe_k, vance_m)
      if (last && first) {
        const cleanLast = last.replace(/[^a-z0-9]/g, '');
        const cleanFirstInit = first[0].toLowerCase();
        let standardUser = `${cleanLast}_${cleanFirstInit}`;
        let suffix = 2;
        while (usedUsernames.has(standardUser)) {
          standardUser = `${cleanLast}_${cleanFirstInit}${suffix}`;
          suffix += 1;
        }
        usedUsernames.add(standardUser);
        insertUser.run(standardUser, hash, emp.id, isManager);

        // Also add full name: firstname_lastname (e.g. devon_miller, kofi_achebe)
        const cleanFirst = first.replace(/[^a-z0-9]/g, '');
        const fullNameUser = `${cleanFirst}_${cleanLast}`;
        if (!usedUsernames.has(fullNameUser)) {
          usedUsernames.add(fullNameUser);
          insertUser.run(fullNameUser, hash, emp.id, isManager);
        }
      }

      // 2. Simple first name if unique (e.g. alice, bob, devon)
      if (first && !usedUsernames.has(first)) {
        usedUsernames.add(first);
        insertUser.run(first, hash, emp.id, isManager);
      }
    }

    // 3. Explicit forced role aliases (e.g. gii_ceo, gii_ipm, gii_fieldlead, gii_programofficer)
    for (const employee of allEmployees) {
      if (!employee.forcedUsername) continue;
      const preferredUsername = employee.forcedUsername.toLowerCase();
      if (!usedUsernames.has(preferredUsername)) {
        usedUsernames.add(preferredUsername);
        const hash = bcrypt.hashSync('password123', 4);
        const isManager = employee.isManager ? 1 : 0;
        insertUser.run(preferredUsername, hash, employee.id, isManager);
      }
    }

    // Seed Survey Templates
    seedSurveyTemplates();

    // Seed Publish SLAs (14 days advance for all sites)
    const insertSla = db.prepare('INSERT OR IGNORE INTO publish_sla (site_id, advance_days) VALUES (?, ?)');
    for (const site of seededSites) {
      insertSla.run(site.id, 14);
    }

    // Seed Survey Campaigns and sample responses for realistic immediate results
    const giiSite = seededSites.find(s => s.name === 'Global Impact Initiative');
    const templates = db.prepare('SELECT * FROM survey_templates').all() as any[];
    const giiTemplate = templates.find(t => t.instrument === 'GII-HUMANITARIAN') || templates[0];
    const cbiTemplate = templates.find(t => t.instrument === 'CBI') || templates[0];

    if (giiSite && giiTemplate) {
      // 1. Active GII humanitarian campaign
      const campResult = db.prepare(`
        INSERT INTO survey_campaigns (
          template_id, site_id, title, start_date, end_date, anonymized, min_group_size, status, recurrence
        ) VALUES (?, ?, ?, ?, ?, 1, 5, 'active', 'weekly')
      `).run(
        giiTemplate.id,
        giiSite.id,
        'Q1 2026 Humanitarian Workforce & Field Pulse',
        addDays(thisMonday, -3),
        addDays(thisMonday, 11)
      );
      const campId = campResult.lastInsertRowid as number;

      // Seed 8 realistic responses for GII so subscales, radars, and recommendations work
      const giiEmployees = db.prepare('SELECT id, department, role_title FROM employees WHERE site_id = ?').all(giiSite.id) as any[];
      const qList = JSON.parse(giiTemplate.questions || '[]');

      for (let idx = 0; idx < Math.min(8, giiEmployees.length); idx++) {
        const emp = giiEmployees[idx];
        const respResult = db.prepare(`
          INSERT INTO survey_responses (campaign_id, employee_id, department, role_title, site_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(campId, emp.id, emp.department, emp.role_title, giiSite.id);
        const respId = respResult.lastInsertRowid as number;

        const insertAnswer = db.prepare('INSERT INTO survey_answers (response_id, question_id, score) VALUES (?, ?, ?)');
        for (const q of qList) {
          // Give higher fatigue/trauma scores for child care and field coordinators
          let baseScore = 2;
          if (emp.department.includes('Child') || emp.department.includes('Emergency')) {
            baseScore = (idx % 2 === 0) ? 4 : 3;
          } else {
            baseScore = (idx % 3 === 0) ? 3 : 2;
          }
          insertAnswer.run(respId, q.id, baseScore);
        }
      }

      // 2. Closed CBI campaign with full historical responses
      if (cbiTemplate) {
        const cbiResult = db.prepare(`
          INSERT INTO survey_campaigns (
            template_id, site_id, title, start_date, end_date, anonymized, min_group_size, status, recurrence
          ) VALUES (?, ?, ?, ?, ?, 1, 5, 'closed', 'none')
        `).run(
          cbiTemplate.id,
          giiSite.id,
          '2025 Annual Non-Profit Exhaustion & Recovery Benchmark',
          addDays(thisMonday, -60),
          addDays(thisMonday, -30)
        );
        const cbiCampId = cbiResult.lastInsertRowid as number;
        const cbiQuestions = JSON.parse(cbiTemplate.questions || '[]');

        for (let idx = 0; idx < Math.min(12, giiEmployees.length); idx++) {
          const emp = giiEmployees[idx];
          const respResult = db.prepare(`
            INSERT INTO survey_responses (campaign_id, employee_id, department, role_title, site_id)
            VALUES (?, ?, ?, ?, ?)
          `).run(cbiCampId, emp.id, emp.department, emp.role_title, giiSite.id);
          const respId = respResult.lastInsertRowid as number;

          const insertAnswer = db.prepare('INSERT INTO survey_answers (response_id, question_id, score) VALUES (?, ?, ?)');
          for (const q of cbiQuestions) {
            const score = ((idx * 7 + q.id.length) % 4) + 2; // 2 to 5
            insertAnswer.run(respId, q.id, Math.min(5, score));
          }
        }
      }
    }

    // Seed Open Shifts, Offers, Shift Swaps & Time-Off Requests across sites
    const insertOpenShift = db.prepare(`
      INSERT INTO open_shifts (
        schedule_id, site_id, date, start_time, end_time, role,
        required_certifications, reason, status, deadline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertOpenShiftOffer = db.prepare(`
      INSERT INTO open_shift_offers (
        open_shift_id, employee_id, status, manager_notes
      ) VALUES (?, ?, ?, ?)
    `);
    const insertSwap = db.prepare(`
      INSERT INTO shift_swaps (
        shift_id, requester_id, target_id, reason, status, manager_notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertTimeOff = db.prepare(`
      INSERT INTO time_off_requests (
        employee_id, start_date, end_date, reason, status, manager_notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    // 1. Non-Profit / Humanitarian (Global Impact Initiative)
    if (giiSite) {
      const giiSchedId = currentScheduleBySite.get(giiSite.id);
      const giiStaff = db.prepare('SELECT id, name, role, department FROM employees WHERE site_id = ?').all(giiSite.id) as any[];
      const findEmp = (roleName: string) => giiStaff.find(e => e.role === roleName || e.department?.includes(roleName));
      const kofi = findEmp('Field Coordinator') || giiStaff[0];
      const nia = findEmp('Program Officer') || giiStaff[1];
      const devon = giiStaff.find(e => e.name.toLowerCase().includes('devon')) || giiStaff[2];
      const soraya = giiStaff.find(e => e.name.toLowerCase().includes('soraya')) || giiStaff[3];
      const fatima = giiStaff.find(e => e.name.toLowerCase().includes('fatima')) || giiStaff[4];
      const patrick = giiStaff.find(e => e.name.toLowerCase().includes('patrick')) || giiStaff[5];
      const lucas = giiStaff.find(e => e.name.toLowerCase().includes('lucas')) || giiStaff[6];
      const tariq = findEmp('International') || giiStaff[7];

      if (giiSchedId) {
        // Open Shifts
        const os1 = insertOpenShift.run(
          giiSchedId, giiSite.id, addDays(thisMonday, 5), '07:30', '15:30', 'Emergency Field Coordinator',
          JSON.stringify(['CPR / BLS First Aid', 'Disaster Response (FEMA ICS-100/200)']),
          'Emergency flood relief mobile triage surge coverage', 'open', addDays(thisMonday, 4)
        ).lastInsertRowid as number;
        if (devon) insertOpenShiftOffer.run(os1, devon.id, 'pending', null);
        if (patrick) insertOpenShiftOffer.run(os1, patrick.id, 'pending', null);

        const os2 = insertOpenShift.run(
          giiSchedId, giiSite.id, addDays(thisMonday, 3), '11:00', '19:00', 'Child Development Specialist',
          JSON.stringify(['Child Safeguarding & Protection', 'Mental Health First Aid (MHFA)']),
          'Youth after-school psycho-social workshop expansion', 'open', addDays(thisMonday, 2)
        ).lastInsertRowid as number;
        if (soraya) insertOpenShiftOffer.run(os2, soraya.id, 'pending', null);

        const os3 = insertOpenShift.run(
          giiSchedId, giiSite.id, addDays(thisMonday, 4), '08:30', '16:30', 'Community Health Case Worker',
          JSON.stringify(['HIPAA & Patient Privacy', 'Mental Health First Aid (MHFA)']),
          'Mobile clinic community health intake surge', 'open', addDays(thisMonday, 3)
        ).lastInsertRowid as number;
        if (fatima) insertOpenShiftOffer.run(os3, fatima.id, 'pending', null);

        const os4 = insertOpenShift.run(
          giiSchedId, giiSite.id, addDays(thisMonday, 2), '09:00', '13:00', 'Volunteer',
          JSON.stringify(['Volunteer Safety & Code of Conduct']),
          'Emergency nutrition pantry packaging & sorting wave', 'open', addDays(thisMonday, 1)
        ).lastInsertRowid as number;
        if (lucas) insertOpenShiftOffer.run(os4, lucas.id, 'pending', null);
        if (devon) insertOpenShiftOffer.run(os4, devon.id, 'pending', null);

        const os5 = insertOpenShift.run(
          giiSchedId, giiSite.id, addDays(thisMonday, 6), '13:00', '17:00', 'Volunteer',
          JSON.stringify(['Volunteer Safety & Code of Conduct']),
          'Displaced family welcome aid distribution', 'open', addDays(thisMonday, 5)
        ).lastInsertRowid as number;
        if (patrick) insertOpenShiftOffer.run(os5, patrick.id, 'pending', null);

        // Shift Swaps
        if (kofi) {
          const kofiShift = db.prepare('SELECT id FROM shifts WHERE schedule_id = ? AND employee_id = ? LIMIT 1').get(giiSchedId, kofi.id) as any;
          if (kofiShift) {
            insertSwap.run(kofiShift.id, kofi.id, null, 'Attending UN Regional Disaster Coordination Inter-Agency Briefing', 'pending', null);
          }
        }

        if (nia) {
          const niaShift = db.prepare('SELECT id FROM shifts WHERE schedule_id = ? AND employee_id = ? LIMIT 1').get(giiSchedId, nia.id) as any;
          if (niaShift) {
            insertSwap.run(niaShift.id, nia.id, null, 'USAID Grant M&E Review & Field Site Inspection', 'pending', null);
          }
        }

        if (soraya && lucas) {
          const sorayaShift = db.prepare('SELECT id FROM shifts WHERE schedule_id = ? AND employee_id = ? LIMIT 1').get(giiSchedId, soraya.id) as any;
          if (sorayaShift) {
            insertSwap.run(sorayaShift.id, soraya.id, lucas.id, 'University exam schedule conflict — swapping for Thursday relief wave', 'approved', 'Approved — volunteer weekly hour limits verified.');
          }
        }

        if (fatima && patrick) {
          const fatimaShift = db.prepare('SELECT id FROM shifts WHERE schedule_id = ? AND employee_id = ? LIMIT 1').get(giiSchedId, fatima.id) as any;
          if (fatimaShift) {
            insertSwap.run(fatimaShift.id, fatima.id, patrick.id, 'Attending pediatric trauma clinical workshop', 'pending', null);
          }
        }
      }

      // Time-off requests
      if (kofi) {
        insertTimeOff.run(kofi.id, addDays(thisMonday, 10), addDays(thisMonday, 14), 'Post-deployment mental health decompression & mandatory rest window', 'pending', null);
      }
      if (nia) {
        insertTimeOff.run(nia.id, addDays(thisMonday, 18), addDays(thisMonday, 20), 'USAID Youth Development Leadership Conference in Washington DC', 'pending', null);
      }
      if (devon) {
        insertTimeOff.run(devon.id, addDays(thisMonday, 3), addDays(thisMonday, 6), 'Midterm examinations & university study leave', 'approved', 'Approved — thank you for your ongoing community service!');
      }
      if (tariq) {
        insertTimeOff.run(tariq.id, addDays(thisMonday, 25), addDays(thisMonday, 29), 'Annual scheduled PTO & personal respite', 'pending', null);
      }
      if (fatima) {
        insertTimeOff.run(fatima.id, addDays(thisMonday, 8), addDays(thisMonday, 9), 'Pediatric Trauma & Clinical First Aid Certification Course', 'approved', 'Approved — professional development credit applied.');
      }
    }

    // 2. Hospitality / Restaurants (Bella Napoli & The Blue Door)
    for (const site of seededSites) {
      if (site.siteType !== 'restaurant') continue;
      const schedId = currentScheduleBySite.get(site.id);
      const staff = db.prepare('SELECT id, name, role FROM employees WHERE site_id = ?').all(site.id) as any[];
      if (!schedId || staff.length === 0) continue;

      const server = staff.find(e => e.role === 'Server') || staff[0];
      const cook = staff.find(e => e.role === 'Line Cook') || staff[1];
      const host = staff.find(e => e.role === 'Host') || staff[2];

      // Open shifts
      if (server) {
        const osA = insertOpenShift.run(
          schedId, site.id, addDays(thisMonday, 4), '16:00', '23:00', 'Server',
          JSON.stringify(['ServSafe Food Handler', 'TIPS / Alcohol Service']),
          'Weekend dinner rush dining room volume surge', 'open', addDays(thisMonday, 3)
        ).lastInsertRowid as number;
        if (host) insertOpenShiftOffer.run(osA, host.id, 'pending', null);
      }
      if (cook) {
        insertOpenShift.run(
          schedId, site.id, addDays(thisMonday, 5), '15:00', '23:00', 'Line Cook',
          JSON.stringify(['ServSafe Manager / Kitchen']),
          'Private banquet & catering event surge', 'open', addDays(thisMonday, 4)
        );
      }

      // Swaps
      if (server) {
        const serverShift = db.prepare('SELECT id FROM shifts WHERE schedule_id = ? AND employee_id = ? LIMIT 1').get(schedId, server.id) as any;
        if (serverShift) {
          insertSwap.run(serverShift.id, server.id, null, 'Family celebration dinner conflict — dropping for open pickup', 'pending', null);
        }
      }

      // Time-off
      if (server) {
        insertTimeOff.run(server.id, addDays(thisMonday, 12), addDays(thisMonday, 15), 'Family vacation and personal travel', 'pending', null);
      }
      if (cook) {
        insertTimeOff.run(cook.id, addDays(thisMonday, 7), addDays(thisMonday, 8), 'Culinary Skills & ServSafe Master Workshop', 'approved', 'Approved — kitchen coverage scheduled.');
      }
    }

    // Seed comprehensive 7-day logical availability for every employee
    seedLogicalAvailability(db, allEmployees);

    validateSeedData();
  })();
}

function seedLogicalAvailability(db: Database.Database, allEmployees: any[]): void {
  const insertAvail = db.prepare(`
    INSERT OR REPLACE INTO availability (
      employee_id, day_of_week, start_time, end_time, availability_type
    ) VALUES (?, ?, ?, ?, ?)
  `);

  // Query all active shifts to know exact scheduled windows
  const allShifts = db.prepare(`
    SELECT employee_id, date, start_time, end_time FROM shifts WHERE status != 'cancelled'
  `).all() as { employee_id: number; date: string; start_time: string; end_time: string }[];

  // Group shifts by employee and day_of_week (0=Sun, 1=Mon, ..., 6=Sat)
  const shiftMap = new Map<string, { start: string; end: string }[]>();
  for (const s of allShifts) {
    if (!s.employee_id) continue;
    const [y, m, d] = s.date.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const key = `${s.employee_id}_${dayOfWeek}`;
    const list = shiftMap.get(key) || [];
    list.push({ start: s.start_time, end: s.end_time });
    shiftMap.set(key, list);
  }

  for (const emp of allEmployees) {
    const role = emp.role || 'Staff';
    const isVolunteer = emp.is_volunteer || role === 'Volunteer';
    const isOffice = ['Manager', 'Finance and HR Coordinator', 'Monitoring and Evaluation Officer', 'Logistics and Grants Coordinator'].includes(role);

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const key = `${emp.id}_${dayOfWeek}`;
      const scheduledShifts = shiftMap.get(key);

      if (scheduledShifts && scheduledShifts.length > 0) {
        // Find earliest start and latest end among scheduled shifts
        let earliestMin = 24 * 60;
        let latestMin = 0;
        for (const sh of scheduledShifts) {
          const [shH, shM] = sh.start.split(':').map(Number);
          const [ehH, ehM] = sh.end.split(':').map(Number);
          const startMin = shH * 60 + shM;
          let endMin = ehH * 60 + ehM;
          if (endMin <= startMin) endMin += 24 * 60;
          if (startMin < earliestMin) earliestMin = startMin;
          if (endMin > latestMin) latestMin = endMin;
        }

        // Expand available window by 60 mins on both sides for realistic buffer
        const availStartMin = Math.max(0, earliestMin - 60);
        const availEndMin = Math.min(23 * 60 + 59, latestMin + 60);

        const pad = (n: number) => String(n).padStart(2, '0');
        const startStr = `${pad(Math.floor(availStartMin / 60))}:${pad(availStartMin % 60)}`;
        const endStr = `${pad(Math.min(23, Math.floor(availEndMin / 60)))}:${pad(availEndMin % 60)}`;

        insertAvail.run(emp.id, dayOfWeek, startStr, endStr, 'specific');
      } else {
        // Employee has no shift scheduled on this day
        if (isVolunteer) {
          // Volunteers are unavailable on unscheduled days except on alternating open relief days
          if (dayOfWeek === 0 || dayOfWeek === 6 || (emp.id + dayOfWeek) % 2 === 0) {
            insertAvail.run(emp.id, dayOfWeek, '00:00', '00:00', 'unavailable');
          } else {
            insertAvail.run(emp.id, dayOfWeek, '08:30', '17:30', 'specific');
          }
        } else if (isOffice) {
          // Office staff: Saturday (6) and Sunday (0) are unavailable rest days
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            insertAvail.run(emp.id, dayOfWeek, '00:00', '00:00', 'unavailable');
          } else {
            insertAvail.run(emp.id, dayOfWeek, '08:30', '17:30', 'specific');
          }
        } else {
          // Field coordinators, clinicians, servers, line cooks:
          // Designate 1-2 realistic rest days per week
          const restDay1 = (emp.id * 3) % 7;
          const restDay2 = (emp.id * 3 + 1) % 7;
          if (dayOfWeek === restDay1 || dayOfWeek === restDay2) {
            insertAvail.run(emp.id, dayOfWeek, '00:00', '00:00', 'unavailable');
          } else {
            const roleTimes = shiftWindowForRole(emp.role, emp.roleIndex || 0);
            const [shH, shM] = roleTimes.start.split(':').map(Number);
            const [ehH, ehM] = roleTimes.end.split(':').map(Number);
            const availStart = Math.max(0, shH * 60 + shM - 60);
            const availEnd = Math.min(23 * 60 + 59, (ehH * 60 + ehM) + 60);
            const pad = (n: number) => String(n).padStart(2, '0');
            const startStr = `${pad(Math.floor(availStart / 60))}:${pad(availStart % 60)}`;
            const endStr = `${pad(Math.min(23, Math.floor(availEnd / 60)))}:${pad(availEnd % 60)}`;
            insertAvail.run(emp.id, dayOfWeek, startStr, endStr, 'specific');
          }
        }
      }
    }
  }
}

export function validateSeedData(): void {
  const db = getDb();

  const siteCount = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as any).c;
  if (siteCount < EXPECTED_SITES.length) throw new Error(`Seed validation: expected ≥ ${EXPECTED_SITES.length} sites, found ${siteCount}`);

  for (const expectedSite of EXPECTED_SITES) {
    const found = db.prepare('SELECT COUNT(*) as c FROM sites WHERE name = ? AND site_type = ?').get(expectedSite.name, expectedSite.siteType) as any;
    if ((found?.c || 0) === 0) {
      throw new Error(`Seed validation: missing expected site ${expectedSite.name} (${expectedSite.siteType})`);
    }
  }

  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
  if (empCount < MIN_EXPECTED_EMPLOYEES || empCount > MAX_EMPLOYEES) {
    throw new Error(`Seed validation: expected ${MIN_EXPECTED_EMPLOYEES}-${MAX_EMPLOYEES} employees, found ${empCount}`);
  }

  const schedulesWithNoShifts = db.prepare(`
    SELECT sc.id FROM schedules sc
    LEFT JOIN shifts sh ON sh.schedule_id = sc.id
    GROUP BY sc.id HAVING COUNT(sh.id) = 0
  `).all() as any[];
  if (schedulesWithNoShifts.length > 0) {
    throw new Error(`Seed validation: ${schedulesWithNoShifts.length} schedule(s) have no shifts`);
  }

  const managersWithNoShifts = db.prepare(`
    SELECT e.id, e.name FROM employees e
    JOIN users u ON u.employee_id = e.id
    WHERE e.role = 'Manager' AND u.is_manager = 1
      AND NOT EXISTS (SELECT 1 FROM shifts sh WHERE sh.employee_id = e.id)
  `).all() as any[];
  if (managersWithNoShifts.length > 0) {
    throw new Error(`Seed validation: managers with no shifts: ${managersWithNoShifts.map((m: any) => m.name).join(', ')}`);
  }

  const availCount = (db.prepare('SELECT COUNT(*) as c FROM availability').get() as any).c;
  if (availCount < empCount * 7) {
    throw new Error(`Seed validation: expected at least ${empCount * 7} availability entries, found ${availCount}`);
  }

  console.log(
    `✓ Seed validation passed — ${siteCount} sites, ${empCount} employees, ${availCount} availability entries, all schedules have shifts, all managers have shifts`
  );
}

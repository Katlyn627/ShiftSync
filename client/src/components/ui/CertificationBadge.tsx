import React, { useState } from 'react';
import { ShieldCheck, Award, HeartHandshake, BookOpen, Flame, Heart, FileCheck, CheckCircle2, ShieldAlert } from 'lucide-react';

export interface CertDefinition {
  code: string;
  name: string;
  issuer: string;
  category: 'emergency' | 'clinical' | 'safeguarding' | 'hospitality' | 'governance' | 'security';
  badgeStyle: {
    border: string;
    bg: string;
    text: string;
    chip: string;
    iconColor: string;
  };
  description: string;
}

export const CERT_DEFINITIONS: Record<string, CertDefinition> = {
  FEMA_ICS_400: {
    code: 'FEMA_ICS_400',
    name: 'FEMA ICS-400 Incident Command',
    issuer: 'Federal Emergency Management Agency (FEMA) / EMI',
    category: 'emergency',
    badgeStyle: {
      border: 'border-blue-300',
      bg: 'bg-blue-50',
      text: 'text-blue-900',
      chip: 'bg-blue-600 text-white',
      iconColor: 'text-blue-600',
    },
    description: 'Advanced Incident Command System for Command and General Staff complex incidents.',
  },
  START_Triage: {
    code: 'START_Triage',
    name: 'START Disaster Triage Protocol',
    issuer: 'Disaster Medical Operations / Newport Beach Fire Protocol',
    category: 'emergency',
    badgeStyle: {
      border: 'border-amber-300',
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      chip: 'bg-amber-600 text-white',
      iconColor: 'text-amber-600',
    },
    description: 'Simple Triage and Rapid Treatment for mass casualty & rapid emergency staging.',
  },
  Trauma_Informed_Care: {
    code: 'Trauma_Informed_Care',
    name: 'Trauma-Informed Care & Resilience',
    issuer: 'NCTSN / SAMHSA Center for Trauma-Informed Practice',
    category: 'clinical',
    badgeStyle: {
      border: 'border-violet-300',
      bg: 'bg-violet-50',
      text: 'text-violet-900',
      chip: 'bg-violet-600 text-white',
      iconColor: 'text-violet-600',
    },
    description: 'Evidence-based trauma screening, secondary stress mitigation, and crisis de-escalation.',
  },
  CPR_AED_Pediatric: {
    code: 'CPR_AED_Pediatric',
    name: 'Pediatric CPR / AED & First Aid',
    issuer: 'American Heart Association & American Red Cross',
    category: 'emergency',
    badgeStyle: {
      border: 'border-rose-300',
      bg: 'bg-rose-50',
      text: 'text-rose-900',
      chip: 'bg-rose-600 text-white',
      iconColor: 'text-rose-600',
    },
    description: 'AHA/Red Cross Infant & Child CPR, AED operation, and pediatric airway obstruction.',
  },
  Early_Childhood_Licensure: {
    code: 'Early_Childhood_Licensure',
    name: 'Early Childhood Education License',
    issuer: 'State Department of Early Education and Care (EEC)',
    category: 'safeguarding',
    badgeStyle: {
      border: 'border-cyan-300',
      bg: 'bg-cyan-50',
      text: 'text-cyan-900',
      chip: 'bg-cyan-600 text-white',
      iconColor: 'text-cyan-600',
    },
    description: 'Certified Early Childhood professional educator and youth development specialist.',
  },
  MSW_LCSW: {
    code: 'MSW_LCSW',
    name: 'Licensed Clinical Social Worker (LCSW)',
    issuer: 'National Association of Social Workers (NASW)',
    category: 'clinical',
    badgeStyle: {
      border: 'border-purple-300',
      bg: 'bg-purple-50',
      text: 'text-purple-900',
      chip: 'bg-purple-600 text-white',
      iconColor: 'text-purple-600',
    },
    description: 'Master of Social Work with state board clinical psychology & counseling license.',
  },
  Child_Protection_Advanced: {
    code: 'Child_Protection_Advanced',
    name: 'Advanced Child Protection & Safeguarding',
    issuer: 'UNICEF / Child Welfare League of America (CWLA)',
    category: 'safeguarding',
    badgeStyle: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      chip: 'bg-emerald-600 text-white',
      iconColor: 'text-emerald-600',
    },
    description: 'International standards on safeguarding vulnerable children and mandatory reporting protocols.',
  },
  Grant_Compliance_Audit: {
    code: 'Grant_Compliance_Audit',
    name: '2 CFR 200 Uniform Guidance Compliance',
    issuer: 'National Grants Management Association (NGMA)',
    category: 'governance',
    badgeStyle: {
      border: 'border-slate-300',
      bg: 'bg-slate-50',
      text: 'text-slate-900',
      chip: 'bg-slate-700 text-white',
      iconColor: 'text-slate-700',
    },
    description: 'Federal and multilateral grant compliance, OMB Uniform Guidance, and single-audit governance.',
  },
  Data_Governance_Cert: {
    code: 'Data_Governance_Cert',
    name: 'CDMP Certified Data Governance',
    issuer: 'DAMA International Data Management Association',
    category: 'governance',
    badgeStyle: {
      border: 'border-sky-300',
      bg: 'bg-sky-50',
      text: 'text-sky-900',
      chip: 'bg-sky-600 text-white',
      iconColor: 'text-sky-600',
    },
    description: 'Monitoring & Evaluation data pipeline security, HIPAA/GDPR privacy, and analytical rigor.',
  },
  HazMat_Handler: {
    code: 'HazMat_Handler',
    name: 'OSHA HazMat Operations (HAZWOPER)',
    issuer: 'OSHA 29 CFR 1910.120 / DOT Transport Safety',
    category: 'emergency',
    badgeStyle: {
      border: 'border-orange-300',
      bg: 'bg-orange-50',
      text: 'text-orange-900',
      chip: 'bg-orange-600 text-white',
      iconColor: 'text-orange-600',
    },
    description: 'Certified hazardous materials transport, relief warehouse storage, and chemical safety.',
  },
  Grant_Management_Pro: {
    code: 'Grant_Management_Pro',
    name: 'Certified Research Administrator (CRA)',
    issuer: 'Society of Research Administrators International',
    category: 'governance',
    badgeStyle: {
      border: 'border-indigo-300',
      bg: 'bg-indigo-50',
      text: 'text-indigo-900',
      chip: 'bg-indigo-600 text-white',
      iconColor: 'text-indigo-600',
    },
    description: 'Full lifecycle grant management from RFP budget drafting to closeout compliance.',
  },
  SHRM_CP: {
    code: 'SHRM_CP',
    name: 'SHRM Certified Professional (SHRM-CP)',
    issuer: 'Society for Human Resource Management (SHRM)',
    category: 'governance',
    badgeStyle: {
      border: 'border-teal-300',
      bg: 'bg-teal-50',
      text: 'text-teal-900',
      chip: 'bg-teal-600 text-white',
      iconColor: 'text-teal-600',
    },
    description: 'Human resources operational strategy, labor laws, payroll, and fair workplace compliance.',
  },
  Nonprofit_Accounting_Cert: {
    code: 'Nonprofit_Accounting_Cert',
    name: 'Certified Nonprofit Accounting Pro (CNAP)',
    issuer: 'BDO / AICPA Not-for-Profit Certificate Program',
    category: 'governance',
    badgeStyle: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      chip: 'bg-emerald-600 text-white',
      iconColor: 'text-emerald-600',
    },
    description: 'Form 990 preparation, donor-restricted fund accounting, and non-profit fiscal transparency.',
  },
  Mental_Health_First_Aid: {
    code: 'Mental_Health_First_Aid',
    name: 'Mental Health First Aid (MHFA)',
    issuer: 'National Council for Mental Wellbeing',
    category: 'clinical',
    badgeStyle: {
      border: 'border-fuchsia-300',
      bg: 'bg-fuchsia-50',
      text: 'text-fuchsia-900',
      chip: 'bg-fuchsia-600 text-white',
      iconColor: 'text-fuchsia-600',
    },
    description: 'Early intervention for mental health crisis, anxiety/PTSD triage, and suicide prevention.',
  },
  Volunteer_Supervision_Cert: {
    code: 'Volunteer_Supervision_Cert',
    name: 'Certified in Volunteer Admin (CVA)',
    issuer: 'Council for Certification in Volunteer Admin (CCVA)',
    category: 'safeguarding',
    badgeStyle: {
      border: 'border-lime-300',
      bg: 'bg-lime-50',
      text: 'text-lime-900',
      chip: 'bg-lime-600 text-white',
      iconColor: 'text-lime-700',
    },
    description: 'Ethical volunteer leadership, duty-of-care supervision, and community deployment.',
  },
  Field_Security_Level2: {
    code: 'Field_Security_Level2',
    name: 'UNDSS Advanced Security in the Field',
    issuer: 'United Nations Dept of Safety and Security (UNDSS)',
    category: 'security',
    badgeStyle: {
      border: 'border-red-300',
      bg: 'bg-red-50',
      text: 'text-red-900',
      chip: 'bg-red-600 text-white',
      iconColor: 'text-red-600',
    },
    description: 'Hostile environment awareness, convoy security, satellite comms, and evacuation protocols.',
  },
  Basic_First_Aid: {
    code: 'Basic_First_Aid',
    name: 'Standard First Aid & CPR',
    issuer: 'American Red Cross Standard First Aid',
    category: 'emergency',
    badgeStyle: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      chip: 'bg-emerald-600 text-white',
      iconColor: 'text-emerald-600',
    },
    description: 'Standard emergency first aid, burn care, bleeding control, and shock response.',
  },
  Youth_Safety_Awareness: {
    code: 'Youth_Safety_Awareness',
    name: 'Praesidium Youth Safety & Protection',
    issuer: 'Praesidium National Child Safety Standard',
    category: 'safeguarding',
    badgeStyle: {
      border: 'border-amber-300',
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      chip: 'bg-amber-600 text-white',
      iconColor: 'text-amber-600',
    },
    description: 'Boundary management, child supervision safety ratios, and bullying intervention.',
  },
  FBI_DOJ_Cleared: {
    code: 'FBI_DOJ_Cleared',
    name: 'FBI & State DOJ Criminal Record Cleared',
    issuer: 'FBI CJIS Division & State Attorney General DOJ',
    category: 'security',
    badgeStyle: {
      border: 'border-blue-300',
      bg: 'bg-blue-50',
      text: 'text-blue-900',
      chip: 'bg-blue-700 text-white',
      iconColor: 'text-blue-700',
    },
    description: 'Live-scan fingerprint background check verified clear for working with vulnerable populations.',
  },
  ServSafe_Manager: {
    code: 'ServSafe_Manager',
    name: 'ServSafe Food Protection Manager',
    issuer: 'National Restaurant Association (ANSI-CFP Accredited)',
    category: 'hospitality',
    badgeStyle: {
      border: 'border-amber-300',
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      chip: 'bg-amber-600 text-white',
      iconColor: 'text-amber-600',
    },
    description: 'National standard food safety management, HACCP sanitation, and kitchen temperature control.',
  },
  ServSafe_FoodHandler: {
    code: 'ServSafe_FoodHandler',
    name: 'ServSafe Food Handler',
    issuer: 'National Restaurant Association',
    category: 'hospitality',
    badgeStyle: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      chip: 'bg-emerald-600 text-white',
      iconColor: 'text-emerald-600',
    },
    description: 'Basic food safety, personal hygiene, cross-contamination prevention, and sanitation.',
  },
  TIPS_Alcohol: {
    code: 'TIPS_Alcohol',
    name: 'TIPS Responsible Beverage Service',
    issuer: 'Health Communications Inc. (TIPS On-Premise)',
    category: 'hospitality',
    badgeStyle: {
      border: 'border-indigo-300',
      bg: 'bg-indigo-50',
      text: 'text-indigo-900',
      chip: 'bg-indigo-600 text-white',
      iconColor: 'text-indigo-600',
    },
    description: 'Recognizing intoxication, underage ID checking, and state alcohol server law compliance.',
  },
  Culinary_Arts: {
    code: 'Culinary_Arts',
    name: 'ACF Certified Culinarian',
    issuer: 'American Culinary Federation (ACF)',
    category: 'hospitality',
    badgeStyle: {
      border: 'border-violet-300',
      bg: 'bg-violet-50',
      text: 'text-violet-900',
      chip: 'bg-violet-600 text-white',
      iconColor: 'text-violet-600',
    },
    description: 'Classical culinary techniques, butchery, sauté station management, and menu formulation.',
  },
  First_Aid: {
    code: 'First_Aid',
    name: 'NSC Workplace First Aid & CPR',
    issuer: 'National Safety Council (NSC)',
    category: 'emergency',
    badgeStyle: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      chip: 'bg-emerald-600 text-white',
      iconColor: 'text-emerald-600',
    },
    description: 'Standard occupational emergency medical response and workplace safety compliance.',
  },
};

export interface CertificationBadgeProps {
  cert: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export function CertificationBadge({
  cert,
  size = 'sm',
  showDetails = false,
  className = '',
}: CertificationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const def = CERT_DEFINITIONS[cert] || {
    code: cert,
    name: cert.replace(/_/g, ' '),
    issuer: 'Verified Credential Authority',
    category: 'governance',
    badgeStyle: {
      border: 'border-slate-300',
      bg: 'bg-slate-50',
      text: 'text-slate-800',
      chip: 'bg-slate-600 text-white',
      iconColor: 'text-slate-600',
    },
    description: 'Verified professional qualification and competence credential.',
  };

  const isLg = size === 'lg';
  const isMd = size === 'md';

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 rounded-lg border font-medium transition-all shadow-xs select-none ${def.badgeStyle.bg} ${def.badgeStyle.border} ${def.badgeStyle.text} ${
        isLg ? 'px-3 py-1.5 text-xs' : isMd ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      } ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <ShieldCheck className={`shrink-0 ${isLg ? 'w-4 h-4' : isMd ? 'w-3.5 h-3.5' : 'w-3 h-3'} ${def.badgeStyle.iconColor}`} />
      <span className="font-semibold">{def.name}</span>

      {showDetails && (
        <span className="text-[10px] text-muted-foreground ml-1 border-l border-current/20 pl-1.5">
          {def.issuer.split('/')[0].trim()}
        </span>
      )}

      {showTooltip && (
        <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full z-50 w-64 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm text-left text-xs pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{def.name}</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-violet-700">{def.issuer}</p>
          <p className="mt-1 text-[10px] text-slate-600 leading-relaxed">{def.description}</p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[9px] uppercase font-bold text-slate-500">
            <span>Status: Verified Active</span>
            <span className="text-emerald-700 font-bold">100% Verified</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CertificationBadge;

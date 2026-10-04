export type LeadStatus = 'New' | 'Contacted' | 'In Discussion' | 'Qualified' | 'Lost';
export type LeadSource = 'Website' | 'Referral' | 'LinkedIn' | 'Campaign' | 'Cold Call' | 'Event';

export interface Lead {
  id: string | number;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  status: LeadStatus;
  score: number; // 0 - 100
  source: LeadSource;
  estimatedValue: number;
  assignedTo: string;
  notes?: string;
  createdAt: string;
}

export type DealStage =
  | 'Prospecting'
  | 'Qualification'
  | 'Proposal'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';

export type PriorityLevel = 'Low' | 'Medium' | 'High';

export interface Deal {
  id: string | number;
  title: string;
  customerId?: string | number;
  customerName: string;
  companyName: string;
  amount: number;
  stage: DealStage;
  probability: number; // percentage 0 - 100
  expectedCloseDate: string;
  priority: PriorityLevel;
  notes?: string;
  assignedTo: string;
  createdAt: string;
  updatedAt?: string;
}

export type CustomerStatus = 'Active' | 'Inactive' | 'Churned';

export interface Customer {
  id: string | number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  status: CustomerStatus;
  totalSpent: number;
  dealsCount: number;
  address?: string;
  city?: string;
  country?: string;
  lastContactDate: string;
  createdAt: string;
}

export type ActivityType = 'Call' | 'Meeting' | 'Email' | 'Task' | 'Note';

export interface Activity {
  id: string | number;
  type: ActivityType;
  title: string;
  relatedType: 'Lead' | 'Customer' | 'Deal';
  relatedId?: string | number;
  relatedName: string;
  dueDate: string;
  completed: boolean;
  priority: PriorityLevel;
  assignee: string;
  notes?: string;
  createdAt: string;
}

export interface CrmStats {
  totalPipelineValue: number;
  activeDealsCount: number;
  wonRevenue: number;
  wonDealsCount: number;
  winRate: number;
  totalLeadsCount: number;
  qualifiedLeadsCount: number;
  leadConversionRate: number;
  totalCustomersCount: number;
  stageDistribution: { stage: DealStage; count: number; value: number }[];
  leadsBySource: { source: LeadSource; count: number }[];
}

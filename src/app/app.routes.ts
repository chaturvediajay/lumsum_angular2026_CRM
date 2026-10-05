import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Home } from './home/home';
import { Leads } from './crm/leads/leads';
import { Deals } from './crm/deals/deals';
import { Customers } from './crm/customers/customers';
import { Activities } from './crm/activities/activities';
import { Reports } from './crm/reports/reports';
import { AiAssistant } from './ai/ai-assistant';
import { User } from './user/user';
import { authGuard, guestGuard } from './guard/auth.guard';

export const routes: Routes = [
  { path: '', component: Login, canActivate: [guestGuard] },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: 'leads', component: Leads, canActivate: [authGuard] },
  { path: 'deals', component: Deals, canActivate: [authGuard] },
  { path: 'customers', component: Customers, canActivate: [authGuard] },
  { path: 'activities', component: Activities, canActivate: [authGuard] },
  { path: 'reports', component: Reports, canActivate: [authGuard] },
  { path: 'ai-assistant', component: AiAssistant, canActivate: [authGuard] },
  { path: 'users', component: User, canActivate: [authGuard] },
  { path: 'sessions', component: User, canActivate: [authGuard] },
  { path: '**', redirectTo: 'home' },
];

import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [publicGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
    canActivate: [publicGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard, roleGuard(['admin'])]
  },
  {
    path: 'teacher',
    loadComponent: () => import('./pages/teacher/teacher.component').then(m => m.TeacherComponent),
    canActivate: [authGuard, roleGuard(['teacher', 'admin'])]
  },
  {
    path: 'student',
    loadComponent: () => import('./pages/student/student.component').then(m => m.StudentComponent),
    canActivate: [authGuard, roleGuard(['student', 'admin'])]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];

import { Component, inject, signal, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserRole } from '../../services/auth.service';
import { CourseService } from '../../services/course.service';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AdminComponent implements OnInit {
  private authService = inject(AuthService);
  private courseService = inject(CourseService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  
  currentUser = signal<User | null>(null);
  userData = signal<any>(null);
  courses = signal<any[]>([]);
  users = signal<Array<{ id: string; email: string; displayName: string; role: UserRole; createdAt: Date }>>([]);
  totalUsers = signal(0);
  totalCourses = signal(0);
  isMigrating = signal(false);
  migrationResult = signal<{ updated: number; errors: number } | null>(null);
  showUserManagement = signal(false);
  isUpdatingRole = signal<string | null>(null);
  
  userForm: FormGroup;

  constructor() {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      role: ['teacher', [Validators.required]]
    });
  }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.currentUser.set(user);
      if (!user) {
        this.router.navigate(['/login']);
      } else {
        this.loadUserData();
        this.loadCourses();
        this.loadUsers();
      }
    });
  }

  async loadUserData() {
    const userData = this.authService.currentUserData();
    this.userData.set(userData);
  }

  loadCourses() {
    this.courseService.getCourses$().subscribe(courses => {
      this.courses.set(courses);
      this.totalCourses.set(courses.length);
    });
  }

  async loadUsers() {
    try {
      const usersList = await this.authService.getAllUsers();
      this.users.set(usersList);
      this.totalUsers.set(usersList.length);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  }

  async updateUserRole(userId: string, newRole: UserRole) {
    if (!confirm(`¿Estás seguro de cambiar el rol del usuario a "${newRole}"?`)) {
      return;
    }

    this.isUpdatingRole.set(userId);
    try {
      await this.authService.updateUserRole(userId, newRole);
      await this.loadUsers();
      alert('Rol actualizado exitosamente');
    } catch (error: any) {
      alert(`Error al actualizar el rol: ${error.message || 'Error desconocido'}`);
      console.error('Error al actualizar rol:', error);
    } finally {
      this.isUpdatingRole.set(null);
    }
  }

  async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    return user?.displayName || user?.email || 'Administrador';
  }

  async migrateUsers() {
    if (!confirm('¿Estás seguro de que deseas migrar todos los usuarios sin rol? Esto asignará el rol "student" por defecto a todos los usuarios que no tengan un rol asignado.')) {
      return;
    }

    this.isMigrating.set(true);
    this.migrationResult.set(null);

    try {
      const result = await this.authService.migrateUsersWithoutRole();
      this.migrationResult.set(result);
      await this.loadUsers();
      alert(`Migración completada:\n- Usuarios actualizados: ${result.updated}\n- Errores: ${result.errors}`);
    } catch (error: any) {
      alert(`Error en la migración: ${error.message || 'Error desconocido'}`);
      console.error('Error en la migración:', error);
    } finally {
      this.isMigrating.set(false);
    }
  }

  getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      admin: 'Administrador',
      teacher: 'Profesor',
      student: 'Estudiante'
    };
    return labels[role] || role;
  }

  getRoleBadgeClass(role: UserRole): string {
    const classes: Record<UserRole, string> = {
      admin: 'bg-red-100 text-red-800',
      teacher: 'bg-blue-100 text-blue-800',
      student: 'bg-green-100 text-green-800'
    };
    return classes[role] || 'bg-gray-100 text-gray-800';
  }
}


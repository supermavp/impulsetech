import { Component, inject, signal, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserRole } from '../../services/auth.service';
import { CourseService, Course, Lesson } from '../../services/course.service';
import { MarkdownService } from '../../services/markdown.service';
import { User } from '@angular/fire/auth';
import { SafeHtml } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AdminComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private courseService = inject(CourseService);
  private markdownService = inject(MarkdownService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  
  currentUser = signal<User | null>(null);
  userData = signal<any>(null);
  courses = signal<Course[]>([]);
  users = signal<Array<{ id: string; email: string; displayName: string; role: UserRole; createdAt: Date }>>([]);
  totalUsers = signal(0);
  totalCourses = signal(0);
  isMigrating = signal(false);
  migrationResult = signal<{ updated: number; errors: number } | null>(null);
  showUserManagement = signal(false);
  showCourseManagement = signal(false);
  isUpdatingRole = signal<string | null>(null);
  
  selectedCourse = signal<Course | null>(null);
  lessons = signal<Lesson[]>([]);
  selectedLesson = signal<Lesson | null>(null);
  viewingLesson = signal(false); // Para vista a pantalla completa
  showCreateLesson = signal(false);
  showEditLesson = signal(false);
  
  userForm: FormGroup;
  lessonForm: FormGroup;

  constructor() {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      role: ['teacher', [Validators.required]]
    });

    this.lessonForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      content: ['', [Validators.required, Validators.minLength(20)]],
      order: [1, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit() {
    this.authService.user$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUser.set(user);
      if (!user) {
        // Cancelar todas las suscripciones cuando el usuario se desautentica
        this.destroy$.next();
        this.router.navigate(['/login']);
      } else {
        this.loadUserData();
        this.loadCourses();
        this.loadUsers();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadUserData() {
    const userData = this.authService.currentUserData();
    this.userData.set(userData);
  }

  loadCourses() {
    this.courseService.getCourses$().pipe(
      takeUntil(this.destroy$)
    ).subscribe(courses => {
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

  /**
   * Convierte Markdown a HTML sanitizado para renderizar en el template
   */
  renderMarkdown(markdown: string | null | undefined): SafeHtml {
    return this.markdownService.toHtml(markdown);
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

  selectCourse(course: Course) {
    this.selectedCourse.set(course);
    this.selectedLesson.set(null);
    this.viewingLesson.set(false);
    this.showEditLesson.set(false);
    if (course.id) {
      this.courseService.getLessonsByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(lessons => {
        this.lessons.set(lessons);
      });
    }
  }

  /**
   * Ver lección a pantalla completa (no modal)
   */
  viewLesson(lesson: Lesson) {
    this.selectedLesson.set(lesson);
    this.viewingLesson.set(true);
  }

  /**
   * Cierra la vista de lección y vuelve al curso
   */
  closeLesson() {
    this.selectedLesson.set(null);
    this.viewingLesson.set(false);
  }

  async createLesson() {
    if (this.lessonForm.invalid) {
      this.markFormGroupTouched(this.lessonForm);
      return;
    }

    const course = this.selectedCourse();
    if (!course || !course.id) return;

    try {
      const { title, description, content, order } = this.lessonForm.value;
      await this.courseService.createLesson({
        courseId: course.id,
        title,
        description,
        content,
        order
      });
      
      this.lessonForm.reset({ order: 1 });
      this.showCreateLesson.set(false);
      
      // Recargar lecciones
      this.courseService.getLessonsByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(lessons => {
        this.lessons.set(lessons);
      });
    } catch (error) {
      console.error('Error al crear lección:', error);
    }
  }

  async updateLesson() {
    if (this.lessonForm.invalid) {
      this.markFormGroupTouched(this.lessonForm);
      return;
    }

    const lesson = this.selectedLesson();
    if (!lesson || !lesson.id) return;

    try {
      const { title, description, content, order } = this.lessonForm.value;
      await this.courseService.updateLesson(lesson.id, {
        title,
        description,
        content,
        order
      });
      
      this.lessonForm.reset({ order: 1 });
      this.showEditLesson.set(false);
      this.selectedLesson.set(null);
      
      // Recargar lecciones
      const course = this.selectedCourse();
      if (course?.id) {
        this.courseService.getLessonsByCourse$(course.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe(lessons => {
          this.lessons.set(lessons);
        });
      }
    } catch (error) {
      console.error('Error al actualizar lección:', error);
    }
  }

  async deleteLesson(lessonId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta lección?')) {
      return;
    }

    try {
      await this.courseService.deleteLesson(lessonId);
      
      // Recargar lecciones
      const course = this.selectedCourse();
      if (course?.id) {
        this.courseService.getLessonsByCourse$(course.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe(lessons => {
          this.lessons.set(lessons);
        });
      }
    } catch (error) {
      console.error('Error al eliminar lección:', error);
      alert('Error al eliminar lección.');
    }
  }

  editLesson(lesson: Lesson) {
    this.selectedLesson.set(lesson);
    this.lessonForm.patchValue({
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      order: lesson.order
    });
    this.showEditLesson.set(true);
  }

  cancelEditLesson() {
    this.selectedLesson.set(null);
    this.showEditLesson.set(false);
    this.lessonForm.reset({ order: 1 });
  }

  closeCourseManagement() {
    this.selectedCourse.set(null);
    this.selectedLesson.set(null);
    this.viewingLesson.set(false);
    this.showEditLesson.set(false);
    this.showCreateLesson.set(false);
    this.lessons.set([]);
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}


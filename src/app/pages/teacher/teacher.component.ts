import { Component, inject, signal, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CourseService, Course, Lesson } from '../../services/course.service';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-teacher',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './teacher.component.html',
  styleUrl: './teacher.component.css',
  encapsulation: ViewEncapsulation.None
})
export class TeacherComponent implements OnInit {
  private authService = inject(AuthService);
  private courseService = inject(CourseService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  
  currentUser = signal<User | null>(null);
  userData = signal<any>(null);
  courses = signal<Course[]>([]);
  selectedCourse = signal<Course | null>(null);
  enrollments = signal<any[]>([]);
  
  showCreateCourse = signal(false);
  showCreateLesson = signal(false);
  
  courseForm: FormGroup;
  lessonForm: FormGroup;

  constructor() {
    this.courseForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]]
    });

    this.lessonForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      content: ['', [Validators.required, Validators.minLength(20)]],
      order: [1, [Validators.required, Validators.min(1)]]
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
      }
    });
  }

  async loadUserData() {
    const userData = this.authService.currentUserData();
    this.userData.set(userData);
  }

  loadCourses() {
    const user = this.currentUser();
    if (user) {
      this.courseService.getCoursesByTeacher$(user.uid).subscribe(courses => {
        this.courses.set(courses);
      });
    }
  }

  async createCourse() {
    if (this.courseForm.invalid) {
      this.markFormGroupTouched(this.courseForm);
      return;
    }

    const user = this.currentUser();
    if (!user) return;

    try {
      const { title, description } = this.courseForm.value;
      await this.courseService.createCourse({
        title,
        description,
        teacherId: user.uid,
        teacherName: user.displayName || user.email || 'Profesor',
        isActive: true
      });
      
      this.courseForm.reset();
      this.showCreateCourse.set(false);
      this.loadCourses();
    } catch (error) {
      console.error('Error al crear curso:', error);
    }
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
    } catch (error) {
      console.error('Error al crear lección:', error);
    }
  }

  selectCourse(course: Course) {
    this.selectedCourse.set(course);
    if (course.id) {
      this.courseService.getEnrollmentsByCourse$(course.id).subscribe(enrollments => {
        this.enrollments.set(enrollments);
      });
    }
  }

  async updateGrade(enrollmentId: string, grade: number | string) {
    try {
      const gradeNumber = typeof grade === 'string' ? parseFloat(grade) : grade;
      if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 100) {
        return;
      }
      await this.courseService.updateGrade(enrollmentId, gradeNumber);
      const course = this.selectedCourse();
      if (course?.id) {
        this.courseService.getEnrollmentsByCourse$(course.id).subscribe(enrollments => {
          this.enrollments.set(enrollments);
        });
      }
    } catch (error) {
      console.error('Error al actualizar calificación:', error);
    }
  }
  
  onGradeBlur(enrollmentId: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    if (value) {
      this.updateGrade(enrollmentId, value);
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
    return user?.displayName || user?.email || 'Profesor';
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}


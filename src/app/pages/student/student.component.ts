import { Component, inject, signal, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CourseService, Course, Lesson, CourseEnrollment } from '../../services/course.service';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-student',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student.component.html',
  styleUrl: './student.component.css',
  encapsulation: ViewEncapsulation.None
})
export class StudentComponent implements OnInit {
  private authService = inject(AuthService);
  private courseService = inject(CourseService);
  private router = inject(Router);
  
  currentUser = signal<User | null>(null);
  userData = signal<any>(null);
  courses = signal<Course[]>([]);
  enrollments = signal<CourseEnrollment[]>([]);
  selectedCourse = signal<Course | null>(null);
  lessons = signal<Lesson[]>([]);
  
  showAvailableCourses = signal(true);

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.currentUser.set(user);
      if (!user) {
        this.router.navigate(['/login']);
      } else {
        this.loadUserData();
        this.loadCourses();
        this.loadEnrollments();
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
    });
  }

  loadEnrollments() {
    const user = this.currentUser();
    if (user) {
      this.courseService.getEnrollmentsByStudent$(user.uid).subscribe(enrollments => {
        this.enrollments.set(enrollments);
      });
    }
  }

  async enrollInCourse(courseId: string) {
    const user = this.currentUser();
    if (!user || !courseId) return;

    try {
      const course = await this.courseService.getCourse(courseId);
      if (!course) return;

      await this.courseService.enrollStudent(
        courseId,
        user.uid,
        user.displayName || user.email || 'Estudiante'
      );
      
      this.loadEnrollments();
    } catch (error: any) {
      if (error.message === 'Ya estás inscrito en este curso') {
        alert('Ya estás inscrito en este curso');
      } else {
        console.error('Error al inscribirse:', error);
      }
    }
  }

  async selectCourse(course: Course) {
    this.selectedCourse.set(course);
    if (course.id) {
      this.courseService.getLessonsByCourse$(course.id).subscribe(lessons => {
        this.lessons.set(lessons);
      });
    }
  }

  isEnrolled(courseId?: string): boolean {
    if (!courseId) return false;
    return this.enrollments().some(e => e.courseId === courseId);
  }

  getEnrollmentGrade(courseId?: string): number | undefined {
    if (!courseId) return undefined;
    const enrollment = this.enrollments().find(e => e.courseId === courseId);
    return enrollment?.grade;
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
    return user?.displayName || user?.email || 'Estudiante';
  }
}

